const fs = require('fs');
const path = require('path');

const proofsDir = path.join(__dirname, 'proofs');
const outputFile = path.join(__dirname, 'proofs.json');

// Ensure proofs directory exists
if (!fs.existsSync(proofsDir)) {
  fs.mkdirSync(proofsDir, { recursive: true });
}

console.log(`Scanning directory: ${proofsDir}`);

try {
  const files = fs.readdirSync(proofsDir);
  const proofs = [];

  files.forEach(file => {
    if (file.endsWith('.json')) {
      const filePath = path.join(proofsDir, file);
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(content);
        
        // Basic schema verification
        if (data.username && data.project && data.publicCommitment && data.zkProofHash) {
          proofs.push({
            filename: file,
            username: data.username.trim(),
            project: data.project.trim(),
            publicCommitment: data.publicCommitment.trim(),
            zkProofHash: data.zkProofHash.trim(),
            timestamp: data.timestamp || new Date().toISOString()
          });
          console.log(`- Loaded proof for: ${data.username}`);
        } else {
          console.warn(`- Skipped ${file}: Missing required fields (username, project, publicCommitment, zkProofHash)`);
        }
      } catch (err) {
        console.error(`- Error reading/parsing ${file}:`, err.message);
      }
    }
  });

  // Sort proofs by timestamp (newest first)
  proofs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  fs.writeFileSync(outputFile, JSON.stringify(proofs, null, 2));
  console.log(`\nSuccessfully compiled ${proofs.length} proofs into ${outputFile}`);
} catch (err) {
  console.error('Failed to compile proofs:', err.message);
  process.exit(1);
}
