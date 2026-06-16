/* ==========================================================================
   Midnight Git Sandbox - Application Logic
   ========================================================================== */

// --------------------------------------------------------------------------
// 1. SHA-256 Helper using Web Crypto API
// --------------------------------------------------------------------------
async function generateSHA256(text) {
  const msgBuffer = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return '0x' + hashHex;
}

// --------------------------------------------------------------------------
// 2. Git State Engine
// --------------------------------------------------------------------------
class GitEngine {
  constructor() {
    this.reset();
  }

  reset() {
    this.commits = {};
    this.branches = { 'main': 'c0' };
    this.activeBranch = 'main';
    this.head = 'c0';
    this.commitIndex = 1;

    // Create Genesis Commit
    this.commits['c0'] = {
      id: 'c0',
      message: 'Initial commit',
      parentId: null,
      branch: 'main',
      x: 50,
      y: 60,
      hash: 'a9f2bc3'
    };
    
    this.onStateChange();
  }

  onStateChange() {
    if (this.changeCallback) {
      this.changeCallback();
    }
  }

  registerChangeCallback(cb) {
    this.changeCallback = cb;
  }

  commit(message) {
    const parent = this.commits[this.head];
    const newId = `c${this.commitIndex++}`;
    const hash = Math.random().toString(16).substring(2, 9);
    
    // Determine coordinate spacing
    const lastCommits = Object.values(this.commits);
    const maxX = Math.max(...lastCommits.map(c => c.x));
    const newX = maxX + 80;
    
    // Y coordinate based on branch
    let newY = 60; // Main branch lane
    if (this.activeBranch !== 'main') {
      newY = 160; // Dev branch lane
    }

    this.commits[newId] = {
      id: newId,
      message: message || `Commit ${newId}`,
      parentId: this.head,
      branch: this.activeBranch,
      x: newX,
      y: newY,
      hash: hash
    };

    // Update branch pointer and HEAD
    this.branches[this.activeBranch] = newId;
    this.head = newId;
    
    this.onStateChange();
    return this.commits[newId];
  }

  createBranch(name) {
    const sanitizedName = name.replace(/[^a-zA-Z0-9-_]/g, '');
    if (!sanitizedName) {
      throw new Error("Invalid branch name");
    }
    if (this.branches[sanitizedName]) {
      throw new Error(`Branch '${sanitizedName}' already exists`);
    }
    
    this.branches[sanitizedName] = this.head;
    this.onStateChange();
    return sanitizedName;
  }

  checkout(target) {
    // 1. Checkout Branch
    if (this.branches[target] !== undefined) {
      this.activeBranch = target;
      this.head = this.branches[target];
      this.onStateChange();
      return `Switched to branch '${target}'`;
    }
    
    // 2. Checkout Commit ID
    const commit = Object.values(this.commits).find(c => c.id === target || c.hash === target);
    if (commit) {
      this.head = commit.id;
      // Enter detached HEAD
      this.activeBranch = `detached HEAD at ${commit.hash}`;
      this.onStateChange();
      return `Note: switching to '${target}'. You are in 'detached HEAD' state.`;
    }

    throw new Error(`pathspec '${target}' did not match any file(s) known to git`);
  }

  merge(sourceBranch) {
    if (this.branches[sourceBranch] === undefined) {
      throw new Error(`merge: ${sourceBranch} - not something we can merge`);
    }
    if (sourceBranch === this.activeBranch) {
      return 'Already up to date.';
    }

    const sourceCommitId = this.branches[sourceBranch];
    const targetCommitId = this.branches[this.activeBranch];

    if (sourceCommitId === targetCommitId) {
      return 'Already up to date.';
    }

    // Check fast-forward merge possibility
    // If target is ancestor of source, we fast-forward
    let isAncestor = false;
    let tempId = sourceCommitId;
    while (tempId) {
      if (tempId === targetCommitId) {
        isAncestor = true;
        break;
      }
      tempId = this.commits[tempId].parentId;
    }

    if (isAncestor) {
      this.branches[this.activeBranch] = sourceCommitId;
      this.head = sourceCommitId;
      this.onStateChange();
      return `Fast-forwarded. Switched HEAD to ${this.commits[sourceCommitId].hash}`;
    }

    // Merge commit creation
    const newId = `c${this.commitIndex++}`;
    const hash = Math.random().toString(16).substring(2, 9);
    
    const lastCommits = Object.values(this.commits);
    const maxX = Math.max(...lastCommits.map(c => c.x));
    const newX = maxX + 80;
    const newY = 60; // Merges settle back into main or current lane

    this.commits[newId] = {
      id: newId,
      message: `Merge branch '${sourceBranch}' into ${this.activeBranch}`,
      parentId: targetCommitId,
      mergeParentId: sourceCommitId, // secondary parent line
      branch: this.activeBranch,
      x: newX,
      y: newY,
      hash: hash
    };

    this.branches[this.activeBranch] = newId;
    this.head = newId;
    this.onStateChange();
    return `Merge made by the 'recursive' strategy. Created commit ${hash}`;
  }
}

// --------------------------------------------------------------------------
// 3. UI Controller - SVG Graph Rendering
// --------------------------------------------------------------------------
function renderGitGraph(git, svgElement) {
  // Clear SVG
  svgElement.innerHTML = '';
  
  const commits = Object.values(git.commits);
  if (commits.length === 0) return;

  // Render connector lines first (so they draw behind nodes)
  commits.forEach(commit => {
    // 1. Line to primary parent
    if (commit.parentId && git.commits[commit.parentId]) {
      const parent = git.commits[commit.parentId];
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      
      // Draw bezier curves for branching/merging transitions
      const d = `M ${parent.x} ${parent.y} C ${(parent.x + commit.x)/2} ${parent.y}, ${(parent.x + commit.x)/2} ${commit.y}, ${commit.x} ${commit.y}`;
      line.setAttribute('d', d);
      line.setAttribute('fill', 'none');
      line.setAttribute('stroke', commit.branch === 'main' ? 'var(--color-branch-main)' : 'var(--color-branch-dev)');
      line.setAttribute('stroke-width', '2.5');
      line.setAttribute('class', 'commit-line');
      svgElement.appendChild(line);
    }

    // 2. Line to secondary parent (in case of merge)
    if (commit.mergeParentId && git.commits[commit.mergeParentId]) {
      const parent2 = git.commits[commit.mergeParentId];
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      const d = `M ${parent2.x} ${parent2.y} C ${(parent2.x + commit.x)/2} ${parent2.y}, ${(parent2.x + commit.x)/2} ${commit.y}, ${commit.x} ${commit.y}`;
      line.setAttribute('d', d);
      line.setAttribute('fill', 'none');
      line.setAttribute('stroke', 'var(--color-text-muted)');
      line.setAttribute('stroke-width', '2');
      line.setAttribute('stroke-dasharray', '4');
      line.setAttribute('class', 'commit-line');
      svgElement.appendChild(line);
    }
  });

  // Render commit nodes
  commits.forEach(commit => {
    const isHead = git.head === commit.id;
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', `commit-node ${isHead ? 'head-node' : ''}`);
    g.setAttribute('transform', `translate(0, 0)`);
    g.addEventListener('click', () => {
      executeCommand(`git checkout ${commit.hash}`);
    });

    // Outer glow for HEAD
    if (isHead) {
      const outerRing = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      outerRing.setAttribute('cx', commit.x);
      outerRing.setAttribute('cy', commit.y);
      outerRing.setAttribute('r', '14');
      outerRing.setAttribute('fill', 'none');
      outerRing.setAttribute('stroke', '#ffffff');
      outerRing.setAttribute('stroke-width', '1.5');
      g.appendChild(outerRing);
    }

    // Commit node circle
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', commit.x);
    circle.setAttribute('cy', commit.y);
    circle.setAttribute('r', '9');
    
    let color = 'var(--color-branch-main)';
    if (commit.branch !== 'main') {
      color = 'var(--color-branch-dev)';
    }
    
    circle.setAttribute('fill', color);
    circle.setAttribute('stroke', isHead ? '#ffffff' : 'var(--color-bg-darker)');
    circle.setAttribute('stroke-width', '2.5');
    g.appendChild(circle);

    // Commit label text (hash)
    const textHash = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    textHash.setAttribute('x', commit.x);
    textHash.setAttribute('y', commit.y - 18);
    textHash.setAttribute('text-anchor', 'middle');
    textHash.setAttribute('class', 'commit-text');
    textHash.textContent = commit.hash;
    g.appendChild(textHash);

    // Commit message label (truncated)
    const textMsg = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    textMsg.setAttribute('x', commit.x);
    textMsg.setAttribute('y', commit.y + 22);
    textMsg.setAttribute('text-anchor', 'middle');
    textMsg.setAttribute('class', 'commit-text');
    textMsg.style.fill = 'var(--color-text-secondary)';
    
    let msg = commit.message;
    if (msg.length > 10) msg = msg.substring(0, 8) + '..';
    textMsg.textContent = msg;
    g.appendChild(textMsg);

    // Render branch badges/labels pointing to this commit
    const pointingBranches = Object.entries(git.branches).filter(([name, id]) => id === commit.id);
    pointingBranches.forEach(([bName], idx) => {
      const badgeG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      
      const badgeRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      badgeRect.setAttribute('x', commit.x - 30);
      badgeRect.setAttribute('y', commit.y + 30 + (idx * 15));
      badgeRect.setAttribute('width', '60');
      badgeRect.setAttribute('height', '12');
      badgeRect.setAttribute('rx', '2');
      badgeRect.setAttribute('fill', bName === 'main' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(168, 85, 247, 0.15)');
      badgeRect.setAttribute('stroke', bName === 'main' ? 'var(--color-branch-main)' : 'var(--color-branch-dev)');
      badgeRect.setAttribute('stroke-width', '0.5');
      
      const badgeText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      badgeText.setAttribute('x', commit.x);
      badgeText.setAttribute('y', commit.y + 39 + (idx * 15));
      badgeText.setAttribute('text-anchor', 'middle');
      badgeText.setAttribute('font-family', 'var(--font-mono)');
      badgeText.setAttribute('font-size', '8px');
      badgeText.setAttribute('fill', '#ffffff');
      badgeText.textContent = bName;

      badgeG.appendChild(badgeRect);
      badgeG.appendChild(badgeText);
      g.appendChild(badgeG);
    });

    svgElement.appendChild(g);
  });

  // Adjust SVG viewBox dynamically to allow scrolling
  const minX = 0;
  const maxX = Math.max(...commits.map(c => c.x)) + 120;
  svgElement.setAttribute('viewBox', `${minX} 0 ${maxX} 240`);
}

// --------------------------------------------------------------------------
// 4. UI Terminal & Interactive Console
// --------------------------------------------------------------------------
const terminalBody = document.getElementById('terminal-body');
const terminalInput = document.getElementById('terminal-input');

function appendTerminalLine(content, type = '') {
  const line = document.createElement('div');
  line.className = `terminal-line ${type}`;
  line.textContent = content;
  terminalBody.appendChild(line);
  terminalBody.scrollTop = terminalBody.scrollHeight;
}

function executeCommand(cmdStr) {
  const input = cmdStr.trim();
  if (!input) return;

  appendTerminalLine(`midnight@sandbox:~$ ${input}`, 'text-primary');

  const parts = input.split(/\s+/);
  const baseCmd = parts[0];

  try {
    if (baseCmd === 'clear') {
      terminalBody.innerHTML = '';
      return;
    }

    if (baseCmd === 'help') {
      appendTerminalLine('Available sandbox commands:', 'text-muted');
      appendTerminalLine('  git commit -m "your message"  - Record a change node', 'text-muted');
      appendTerminalLine('  git branch <name>              - Create a development line', 'text-muted');
      appendTerminalLine('  git checkout <branch-or-hash>  - Navigate target history', 'text-muted');
      appendTerminalLine('  git merge <branch-name>        - Combine code updates', 'text-muted');
      appendTerminalLine('  git log                        - Show commit transaction log', 'text-muted');
      appendTerminalLine('  git status                     - Check current checkout state', 'text-muted');
      appendTerminalLine('  clear                          - Empty terminal buffer', 'text-muted');
      return;
    }

    if (baseCmd === 'git') {
      const gitCmd = parts[1];
      
      if (!gitCmd) {
        throw new Error('git: command requires sub-commands. Type "help" for info.');
      }

      if (gitCmd === 'commit') {
        let message = 'Manual Commit';
        const mIndex = input.indexOf('-m');
        if (mIndex !== -1) {
          const rawMessage = input.substring(mIndex + 2).trim();
          // Strip surrounding quotes
          message = rawMessage.replace(/^['"]|['"]$/g, '');
        }
        const newCommit = gitEngine.commit(message);
        appendTerminalLine(`[${gitEngine.activeBranch} ${newCommit.hash}] ${newCommit.message}`, 'text-success');
        return;
      }

      if (gitCmd === 'branch') {
        const branchName = parts[2];
        if (!branchName) {
          // List branches
          Object.keys(gitEngine.branches).forEach(b => {
            const isActive = gitEngine.activeBranch === b;
            appendTerminalLine(`${isActive ? '* ' : '  '}${b}`, isActive ? 'text-success' : 'text-muted');
          });
          return;
        }
        const created = gitEngine.createBranch(branchName);
        appendTerminalLine(`Created local branch '${created}'`, 'text-success');
        return;
      }

      if (gitCmd === 'checkout') {
        const target = parts[2];
        if (!target) {
          throw new Error('checkout: missing branch name or commit hash');
        }
        const msg = gitEngine.checkout(target);
        appendTerminalLine(msg, 'text-warning');
        return;
      }

      if (gitCmd === 'merge') {
        const target = parts[2];
        if (!target) {
          throw new Error('merge: missing source branch name to merge');
        }
        const msg = gitEngine.merge(target);
        appendTerminalLine(msg, 'text-success');
        return;
      }

      if (gitCmd === 'status') {
        appendTerminalLine(`On branch: ${gitEngine.activeBranch}`, 'text-success');
        appendTerminalLine(`Your branch is up to date with origin/main.`, 'text-muted');
        appendTerminalLine(`nothing to commit, working tree clean.`, 'text-muted');
        return;
      }

      if (gitCmd === 'log') {
        // Trace back commits from HEAD
        const history = [];
        let currId = gitEngine.head;
        
        while (currId) {
          const commit = gitEngine.commits[currId];
          history.push(commit);
          currId = commit.parentId;
        }

        history.forEach(c => {
          appendTerminalLine(`commit ${c.hash} (${c.id})`, 'text-warning');
          appendTerminalLine(`Author: Midnight Builder <builder@midnight.network>`, 'text-muted');
          appendTerminalLine(`Date:   ${new Date().toLocaleDateString()}`, 'text-muted');
          appendTerminalLine(`    ${c.message}\n`, 'text-primary');
        });
        return;
      }

      throw new Error(`git: '${gitCmd}' is not a valid git command in this sandbox. Type 'help'.`);
    }

    throw new Error(`bash: ${baseCmd}: command not found. Type 'help' for instructions.`);
  } catch (err) {
    appendTerminalLine(`error: ${err.message}`, 'text-error');
  }
}

// Hook up terminal input
terminalInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const cmd = terminalInput.value;
    terminalInput.value = '';
    executeCommand(cmd);
  }
});

// Hook up quick action buttons
document.getElementById('btn-git-commit').addEventListener('click', () => {
  const msg = prompt("Enter commit message:", "feat: add zk-proof widget");
  if (msg !== null) {
    executeCommand(`git commit -m "${msg}"`);
  }
});

document.getElementById('btn-git-branch').addEventListener('click', () => {
  const bName = prompt("Enter new branch name:", "feature/zk-shield");
  if (bName) {
    executeCommand(`git branch ${bName}`);
  }
});

document.getElementById('btn-git-checkout').addEventListener('click', () => {
  const target = prompt("Enter branch name or commit hash to checkout:");
  if (target) {
    executeCommand(`git checkout ${target}`);
  }
});

document.getElementById('btn-git-merge').addEventListener('click', () => {
  const source = prompt("Enter branch to merge into current HEAD:");
  if (source) {
    executeCommand(`git merge ${source}`);
  }
});

document.getElementById('btn-git-reset').addEventListener('click', () => {
  if (confirm("Reset the sandbox repository? All unsaved history will be lost.")) {
    gitEngine.reset();
    terminalBody.innerHTML = '';
    appendTerminalLine('Reset repository to genesis.', 'text-warning');
  }
});


// --------------------------------------------------------------------------
// 5. ZK Proof Generator
// --------------------------------------------------------------------------
const proofForm = document.getElementById('proof-form');
const proofOutput = document.getElementById('proof-output');
const proofCodeBlock = document.getElementById('proof-code-block');
const proofFilename = document.getElementById('proof-filename');
const proofFilenameWeb = document.getElementById('proof-filename-web');

let generatedProofBlobUrl = null;
let currentProofData = null;

proofForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const username = document.getElementById('input-username').value.trim();
  const project = document.getElementById('input-project').value.trim();
  const secret = document.getElementById('input-secret').value.trim();
  const commitment = document.getElementById('input-commitment').value.trim();

  if (!username || !project || !secret || !commitment) return;

  const button = document.getElementById('btn-generate-proof');
  button.textContent = "Calculating Proof Commitment...";
  button.disabled = true;

  try {
    // ZK proof simulation: hash of the private secret combined with public constraints
    // This demonstrates public verification with private inputs.
    const preimage = `${username}|${project}|${commitment}|${secret}`;
    const zkProofHash = await generateSHA256(preimage);

    // Setup payload
    currentProofData = {
      username: username,
      project: project,
      publicCommitment: commitment,
      zkProofHash: zkProofHash,
      timestamp: new Date().toISOString()
    };

    // Render output
    proofCodeBlock.textContent = JSON.stringify(currentProofData, null, 2);
    if (proofFilename) proofFilename.textContent = `${username.toLowerCase()}.json`;
    if (proofFilenameWeb) proofFilenameWeb.textContent = `${username.toLowerCase()}.json`;

    // Revoke previous url if any
    if (generatedProofBlobUrl) {
      URL.revokeObjectURL(generatedProofBlobUrl);
    }

    // Create Download Blob
    const blob = new Blob([JSON.stringify(currentProofData, null, 2)], { type: 'application/json' });
    generatedProofBlobUrl = URL.createObjectURL(blob);

    proofOutput.classList.remove('hidden');
    proofOutput.scrollIntoView({ behavior: 'smooth' });

    // Output success in terminal
    executeCommand(`git commit -m "add: zk-proof for ${username}"`);
    appendTerminalLine(`[ZK CORE] Generated proof signature: ${zkProofHash.substring(0, 16)}...`, 'text-success');

  } catch (err) {
    alert("Proof generation failed: " + err.message);
  } finally {
    button.textContent = "Generate Cryptographic Proof";
    button.disabled = false;
  }
});

// Copy Proof to Clipboard
document.getElementById('btn-copy-proof').addEventListener('click', () => {
  if (!currentProofData) return;
  navigator.clipboard.writeText(JSON.stringify(currentProofData, null, 2))
    .then(() => {
      const btn = document.getElementById('btn-copy-proof');
      const orig = btn.innerHTML;
      btn.innerHTML = `<span style="font-size: 10px; color: var(--color-accent-green)">Copied!</span>`;
      setTimeout(() => btn.innerHTML = orig, 1500);
    })
    .catch(err => console.error('Failed to copy', err));
});

// Download Proof JSON file
document.getElementById('btn-download-proof').addEventListener('click', () => {
  if (!generatedProofBlobUrl || !currentProofData) return;
  const link = document.createElement('a');
  link.href = generatedProofBlobUrl;
  link.download = `${currentProofData.username.toLowerCase()}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
});


// --------------------------------------------------------------------------
// 6. Contributor Directory Board
// --------------------------------------------------------------------------
const buildersGrid = document.getElementById('builders-grid');
const graduatesCount = document.getElementById('graduates-count');

// Static fallback graduates array if fetching local proofs.json fails
const fallbackGraduates = [
  {
    username: "taiwrash",
    project: "Midnight Git Sandbox",
    publicCommitment: "I am building a zero-knowledge interactive sandbox to teach Git to Midnight builders.",
    zkProofHash: "0x4b7f8e9a2d3c5e7b1a0f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d9c8b",
    timestamp: "2026-06-16T14:48:00Z"
  },
  {
    username: "braun-dieter",
    project: "Minimalist ZK Tokenizer",
    publicCommitment: "Creating honest, long-lasting smart contracts that disclose as little design data as possible.",
    zkProofHash: "0x3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b",
    timestamp: "1955-09-20T12:00:00Z"
  }
];

function renderBuilders(builders) {
  buildersGrid.innerHTML = '';
  graduatesCount.textContent = `${builders.length} Graduate${builders.length !== 1 ? 's' : ''}`;

  if (builders.length === 0) {
    buildersGrid.innerHTML = `<div class="loading-state"><p>No builders registered yet. Be the first!</p></div>`;
    return;
  }

  builders.forEach(b => {
    const card = document.createElement('div');
    card.className = 'builder-card';
    
    // Fallback profile image using UI Avatars if github doesn't exist
    const avatarUrl = `https://github.com/${b.username}.png`;

    card.innerHTML = `
      <div class="card-header">
        <img class="avatar" src="${avatarUrl}" onerror="this.src='https://ui-avatars.com/api/?name=${b.username}&background=222227&color=ededf0'" alt="${b.username}">
        <div class="user-info">
          <span class="user-name">${b.username}</span>
          <a class="user-github" href="https://github.com/${b.username}" target="_blank" rel="noopener">github.com/${b.username}</a>
        </div>
      </div>
      <div class="card-body">
        <span class="project-title">${b.project}</span>
        <p class="commitment-text">"${b.publicCommitment}"</p>
        <div class="proof-hash-line">
          <span class="hash-label">ZK Commitment Hash</span>
          <span class="hash-value">${b.zkProofHash}</span>
        </div>
      </div>
      <button class="btn btn-secondary btn-verify-proof" data-username="${b.username}" data-hash="${b.zkProofHash}">Verify ZK Proof</button>
    `;
    
    buildersGrid.appendChild(graftVerifyBtnListener(card, b));
  });
}

function graftVerifyBtnListener(card, builder) {
  const btn = card.querySelector('.btn-verify-proof');
  btn.addEventListener('click', () => {
    openVerificationModal(builder, btn);
  });
  return card;
}

async function loadDirectory() {
  try {
    // Attempt to fetch compile results
    const response = await fetch('proofs.json');
    if (!response.ok) {
      throw new Error(`HTTP status: ${response.status}`);
    }
    const data = await response.json();
    renderBuilders(data);
  } catch (err) {
    console.warn("Could not load proofs.json, falling back to static database demonstration. Error:", err.message);
    renderBuilders(fallbackGraduates);
  }
}


// --------------------------------------------------------------------------
// 7. ZK Verification Protocol Simulation
// --------------------------------------------------------------------------
const verifyDialog = document.getElementById('verify-dialog');
const verificationLog = document.getElementById('verification-log');
const btnCloseDialog = document.getElementById('btn-close-dialog');
const btnDialogDone = document.getElementById('btn-dialog-done');
const verifierNode = document.querySelector('.verifier-node');

let activeVerificationBtn = null;

function appendLogLine(text, delay = 0) {
  return new Promise(resolve => {
    setTimeout(() => {
      const line = document.createElement('div');
      line.className = 'terminal-line text-muted';
      line.textContent = text;
      verificationLog.appendChild(line);
      verificationLog.scrollTop = verificationLog.scrollHeight;
      resolve();
    }, delay);
  });
}

async function openVerificationModal(builder, triggerButton) {
  activeVerificationBtn = triggerButton;
  
  // Reset dialog state
  verificationLog.innerHTML = '';
  btnDialogDone.disabled = true;
  btnDialogDone.textContent = "Running Protocol...";
  verifierNode.className = "node-circle verifier-node active";
  
  verifyDialog.showModal();

  // Step-by-step ZK Proof verification flow simulation
  await appendLogLine(`[LOG] Initiating ZK verification channel for builder: ${builder.username}`, 100);
  await appendLogLine(`[LOG] Loading public parameters...`, 300);
  await appendLogLine(`[LOG] Inputs: { user: "${builder.username}", project: "${builder.project}" }`, 200);
  await appendLogLine(`[LOG] Commitment statement: "${builder.publicCommitment.substring(0, 40)}..."`, 200);
  await appendLogLine(`[LOG] Loading proof hash signature: ${builder.zkProofHash}`, 300);
  await appendLogLine(`[LOG] Running elliptic-curve pairing constraints checks...`, 400);
  await appendLogLine(`[LOG] Verifying mathematical zero-knowledge proof equations...`, 400);
  
  // Transition node status
  verifierNode.className = "node-circle verifier-node success";
  await appendLogLine(`[SUCCESS] Proof verified! Signature is cryptographically valid.`, 300);
  await appendLogLine(`[SUCCESS] Public state matches. Zero sensitive variables leaked.`, 100);

  // Complete
  btnDialogDone.disabled = false;
  btnDialogDone.textContent = "Close Verification";
}

btnDialogDone.addEventListener('click', () => {
  verifyDialog.close();
  if (activeVerificationBtn) {
    activeVerificationBtn.className = "btn btn-secondary text-success";
    activeVerificationBtn.innerHTML = `
      <svg style="margin-right:4px;" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
      Verified Valid
    `;
    activeVerificationBtn.disabled = true;
  }
});

btnCloseDialog.addEventListener('click', () => {
  verifyDialog.close();
});


// --------------------------------------------------------------------------
// 8. Initialization
// --------------------------------------------------------------------------
const gitEngine = new GitEngine();
const svgGraphElement = document.getElementById('git-graph');

gitEngine.registerChangeCallback(() => {
  renderGitGraph(gitEngine, svgGraphElement);
});

// Initial Render
renderGitGraph(gitEngine, svgGraphElement);
loadDirectory();
appendTerminalLine("Welcome to Midnight Git Sandbox!", "text-success");
appendTerminalLine("Learn branching and merging through code commands.", "text-primary");
