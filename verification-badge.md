
## 🔒 On-Chain Verification

Security.txt is embedded on-chain and verified:
```bash
# Download and verify
solana program dump 6Bg1RuRv2yHxJbSodDMKH2dFbDQKGeZwKkDhzZxXQ7xc program.so
strings program.so | grep -A 5 "BEGIN SECURITY.TXT"
```

**Verified URLs:**
- ✅ Project: https://github.com/omenpotter/vesting-halving-program
- ✅ Security: https://github.com/omenpotter/vesting-halving-program/security/advisories/new
- ✅ Policy: https://github.com/omenpotter/vesting-halving-program/blob/main/SECURITY.md

