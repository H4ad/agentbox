// fake-kvm: runs a program with KVM_GET_API_VERSION answered by this
// process, so a Cloud Hypervisor binary on a machine with no KVM gets past
// opening /dev/kvm to parsing and validating its command line. Used by
// chv_args_test.sh, inside a mount namespace whose /dev/kvm is an empty file.
//
//   fake-kvm PROGRAM [ARG...]
//
// A seccomp filter stops the program at every ioctl of KVM's type (0xAE)
// for this process, its tracer (SECCOMP_RET_TRACE). KVM_GET_API_VERSION is
// skipped and returns 12, the one check Cloud Hypervisor v50 makes before it
// parses its options. Every other KVM ioctl is logged and goes through to
// the empty file, which fails it with ENOTTY: the first one after the
// options are parsed and validated, KVM_CREATE_VM, ends the run.
//
// Not a seccomp user-notification listener: containers that stack their own
// seccomp filter (Incus, so AgentBox's agents) refuse one with EINVAL.
#define _GNU_SOURCE
#include <errno.h>
#include <linux/audit.h>
#include <linux/filter.h>
#include <linux/seccomp.h>
#include <signal.h>
#include <stddef.h>
#include <stdio.h>
#include <sys/prctl.h>
#include <sys/ptrace.h>
#include <sys/syscall.h>
#include <sys/user.h>
#include <sys/wait.h>
#include <unistd.h>

#define KVM_TYPE 0xAE
#define KVM_GET_API_VERSION 0xAE00

static int install_filter(void) {
	struct sock_filter f[] = {
		BPF_STMT(BPF_LD | BPF_W | BPF_ABS, offsetof(struct seccomp_data, arch)),
		BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K, AUDIT_ARCH_X86_64, 1, 0),
		BPF_STMT(BPF_RET | BPF_K, SECCOMP_RET_ALLOW),
		BPF_STMT(BPF_LD | BPF_W | BPF_ABS, offsetof(struct seccomp_data, nr)),
		BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K, __NR_ioctl, 1, 0),
		BPF_STMT(BPF_RET | BPF_K, SECCOMP_RET_ALLOW),
		// The request's low 32 bits; its type is bits 8 to 15.
		BPF_STMT(BPF_LD | BPF_W | BPF_ABS, offsetof(struct seccomp_data, args[1])),
		BPF_STMT(BPF_ALU | BPF_AND | BPF_K, 0xff00),
		BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K, KVM_TYPE << 8, 0, 1),
		BPF_STMT(BPF_RET | BPF_K, SECCOMP_RET_TRACE),
		BPF_STMT(BPF_RET | BPF_K, SECCOMP_RET_ALLOW),
	};
	struct sock_fprog prog = {.len = sizeof(f) / sizeof(f[0]), .filter = f};
	if (prctl(PR_SET_NO_NEW_PRIVS, 1, 0, 0, 0))
		return -1;
	return syscall(__NR_seccomp, SECCOMP_SET_MODE_FILTER, 0, &prog);
}

int main(int argc, char **argv) {
	if (argc < 2) {
		fprintf(stderr, "usage: fake-kvm PROGRAM [ARG...]\n");
		return 2;
	}
	pid_t pid = fork();
	if (pid < 0)
		return perror("fork"), 1;
	if (pid == 0) {
		if (ptrace(PTRACE_TRACEME, 0, 0, 0))
			perror("fake-kvm: ptrace"), _exit(126);
		raise(SIGSTOP);
		if (install_filter())
			perror("fake-kvm: seccomp"), _exit(126);
		execvp(argv[1], argv + 1);
		perror("fake-kvm: exec"), _exit(127);
	}

	int st;
	if (waitpid(pid, &st, 0) != pid || !WIFSTOPPED(st))
		return 1;
	ptrace(PTRACE_SETOPTIONS, pid, 0,
	       PTRACE_O_TRACESECCOMP | PTRACE_O_TRACECLONE | PTRACE_O_TRACEFORK |
	           PTRACE_O_TRACEVFORK | PTRACE_O_TRACEEXEC | PTRACE_O_EXITKILL);
	ptrace(PTRACE_CONT, pid, 0, 0);

	for (;;) {
		pid_t t = waitpid(-1, &st, __WALL);
		if (t < 0)
			return 1;
		if (WIFEXITED(st) || WIFSIGNALED(st)) {
			if (t == pid)
				return WIFEXITED(st) ? WEXITSTATUS(st) : 128 + WTERMSIG(st);
			continue;
		}
		if (!WIFSTOPPED(st))
			continue;
		int sig = WSTOPSIG(st), event = st >> 16;
		if (sig == SIGTRAP && event == PTRACE_EVENT_SECCOMP) {
			struct user_regs_struct r;
			ptrace(PTRACE_GETREGS, t, 0, &r);
			unsigned cmd = (unsigned)r.rsi;
			if (cmd == KVM_GET_API_VERSION) {
				// Skip the call; its result is what rax says.
				r.orig_rax = -1;
				r.rax = 12;
				ptrace(PTRACE_SETREGS, t, 0, &r);
			} else {
				fprintf(stderr, "fake-kvm: KVM ioctl 0x%x (fails: no KVM)\n", cmd);
			}
			sig = 0;
		} else if (sig == SIGTRAP && event) {
			sig = 0; // clone, fork, exec events
		} else if (sig == SIGSTOP) {
			sig = 0; // a new thread's first stop
		}
		ptrace(PTRACE_CONT, t, 0, sig);
	}
}
