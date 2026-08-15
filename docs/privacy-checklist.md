# STRK20 Privacy Checklist

This checklist is intended for maintainers and auditors to confirm that the public submission and associated operational practices meet privacy goals. Run this before any mainnet action.

Pre‑deployment
- [ ] Code audit completed for token contract (if applicable)
- [ ] Deployment account is multisig / HSM protected
- [ ] Deployment transaction plan prepared and approvals recorded off‑chain

Repository hygiene
- [ ] No private keys, mnemonics, or seed phrases in the repository
- [ ] No internal mapping tables (user → on‑chain address) present in public files
- [ ] strk20.json contains no PII
- [ ] Demo uses ephemeral/test keys only and includes explicit warnings

Scripts and CI
- [ ] Scripts contain guardrails preventing accidental mainnet runs (checks for MAINNET env var)
- [ ] Example scripts use placeholders for RPC URLs and keys
- [ ] Add or run a secrets scanner locally (examples below)

Off‑chain data handling
- [ ] Mappings and sensitive logs are stored encrypted with RBAC
- [ ] Retention policy defined for ephemeral mappings and logs
- [ ] Audit logs record txHash, timestamp, purposeCode, and signer pseudonym (no raw secrets)

Network / RPC
- [ ] RPC endpoints configurable via environment variables
- [ ] Critical ops use self‑hosted node or rotated provider endpoints

Operational controls
- [ ] Multi‑party approval policy for large transfers is documented
- [ ] Emergency key‑compromise procedure exists (revoke/rotate/pause)

Monitoring
- [ ] Alerts for unusual address clustering or RPC access spikes
- [ ] Regular privacy reviews scheduled (quarterly recommended)

Optional checks (recommended)
- [ ] Use `git-secrets` or `trufflehog` locally to scan repo history for secrets
- [ ] Use a local script to scan newly added files in CI before merge

Sample local secret scan commands (run privately)

- Using git-secrets (install and configure):
  git secrets --register-aws
  git secrets --scan

- Using truffleHog:
  trufflehog --search-branch HEAD .

Notes
- Do not add secret scanning results to the public repository. Run these checks locally or in a private CI environment.
