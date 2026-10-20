# Backports to Cloud Hypervisor v50.0

Applied by the Dockerfile after Spectrum's patchset, in name order. Each is an
upstream commit, unchanged, that v50 lacks.

- `cloud-hypervisor-0001-only-activate-when-the-device-became-ready.patch`:
  upstream 57e766bd (PR #7906, in v52.0), fixing issue #7766. With two or more
  vCPUs, another vCPU writing to a virtio device's BAR before the VMM thread
  has finished activating it queued a second activation with no interrupt
  left, and the VMM panicked (`pci_device.rs:297`, `Option::unwrap()` on
  `None`). It happens with a vhost-user network device served by passt, which
  is how try.sh (and AgentBox's VM) gives the guest its network.
