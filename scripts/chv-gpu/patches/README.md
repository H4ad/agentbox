# Patches

Applied by the Dockerfile in name order: `crosvm-*` to crosvm, `cloud-hypervisor-*`
to Cloud Hypervisor after Spectrum's patchset.

- `crosvm-0001-gpu-render-node-parameter.patch`: **inert for now**: rutabaga
  0.1.75's `get_drm_fd` drops every render node (`is_valid_gpu_path` checks
  `Path::starts_with("/dev/dri/renderD")`, which compares whole components and
  so is false for `/dev/dri/renderD128`). try.sh keeps crosvm to the node with a
  mount namespace instead (`lib/gpu-ns.sh`). Ours, not upstream (crosvm's
  main has no equivalent). A `render-node` key in `device gpu --params`, added
  as a GPU path for rutabaga, which hands its fd to virglrenderer
  (`get_drm_fd`). Without it virglrenderer renders GL on the first
  `/dev/dri/renderD*` that `readdir` returns, which on a machine with an
  integrated and a discrete GPU was the integrated one while Venus used the
  discrete one. try.sh passes its `--render-node`, with `"surfaceless": false`:
  surfaceless, virglrenderer's EGL display is Mesa's default device whatever
  the fd (it only matches an EGL device to the fd when built against minigbm),
  so GBM would be on the node and GL still elsewhere.

The `cloud-hypervisor-*` ones are upstream commits, unchanged, that v50 lacks:

- `cloud-hypervisor-0001-only-activate-when-the-device-became-ready.patch`:
  upstream 57e766bd (PR #7906, in v52.0), fixing issue #7766. With two or more
  vCPUs, another vCPU writing to a virtio device's BAR before the VMM thread
  has finished activating it queued a second activation with no interrupt
  left, and the VMM panicked (`pci_device.rs:297`, `Option::unwrap()` on
  `None`). It happens with a vhost-user network device served by passt, which
  is how try.sh (and AgentBox's VM) gives the guest its network.
