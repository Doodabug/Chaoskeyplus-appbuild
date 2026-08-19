# ChaosKey+ STRK20 Demo Video Script (3 Minutes)

## 0:00 - Introduction (30s)
*Visual: Mobile app home screen (Harvest tab).*
"Hi, I'm presenting ChaosKey+, a cryptographic entropy device that captures physical randomness from your camera and uses it to drive privacy-preserving actions on Starknet."
"Today, we're looking at the STRK20 Privacy Pool integration, which allows users to shield their STRK tokens and move them privately using physical entropy as a binding factor."

## 0:30 - Entropy Harvesting (45s)
*Visual: Switch to Harvest tab, start capturing camera noise.*
"ChaosKey+ isn't just a wallet; it's a randomness generator. Here, we capture visual noise from the camera, run NIST-style health tests, and hash it into a signed ledger."
"This physical chaos is then used to seed our privacy actions, ensuring that even the timing and parameters of our pool interactions are rooted in real-world randomness."

## 1:15 - Wallet Connection (30s)
*Visual: Switch to Pool tab, tap 'Connect Ready'.*
"We've integrated the Starknet Wallet API v6. By connecting a STRK20-capable wallet like Ready, we gain access to the privacy pool without ever handling the user's viewing keys or notes directly."
"The app performs a capability probe to ensure the wallet supports the STRK20 standard."

## 1:45 - Shielding STRK (45s)
*Visual: Enter 1.0 STRK in Shield, tap 'Shield'.*
"Let's shield some STRK. The app triggers two wallet prompts: first, a public ERC-20 approval for the pool contract, and second, the private deposit into the pool."
"Once accepted, our tokens are shielded. On-chain, only the fact that we deposited is visible; the notes themselves are now private."

## 2:30 - Private Transfer & Unshield (30s)
*Visual: Show the Transfer and Unshield buttons.*
"Once notes mature—usually after about 10 blocks—we can perform private transfers where the sender, receiver, and amount are hidden from public view."
"Finally, we can unshield back to a public address when needed."

## 3:00 - Conclusion
"ChaosKey+ combines physical hardware-grade entropy with Starknet's cutting-edge privacy. Thanks for watching!"