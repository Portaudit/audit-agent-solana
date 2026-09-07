import fs from 'fs';

async function runAudit() {
  const diffPath = process.env.PR_DIFF_FILE;
  if (!diffPath || !fs.existsSync(diffPath)) {
    console.log("No diff file found. Skipping audit.");
    console.log("VERDICT: PASS");
    return;
  }

  const diff = fs.readFileSync(diffPath, 'utf8');
  if (diff.trim().length === 0) {
    console.log("Empty diff. Skipping audit.");
    console.log("VERDICT: PASS");
    return;
  }

  const prompt = `You are a senior Solana/Rust security auditor for the AuditAgent project.
Review the following Pull Request diff. Check for:
1. Reentrancy vulnerabilities or missing CPI checks.
2. Missing access controls (e.g., missing has_one or constraint).
3. Integer overflow/underflow.
4. State inconsistencies (e.g., forgetting to update state after a transfer).
5. TypeScript/Node.js logic errors in the orchestrator.

Provide a brief, 2-3 sentence technical reasoning.
On the very last line, output EXACTLY one of these two strings:
VERDICT: PASS
VERDICT: FAIL

PR DIFF:
${diff.slice(0, 12000)}`;

  try {
    const orKey = process.env.OPENROUTER_API_KEY;
    const orModel = process.env.OPENROUTER_MODEL || 'anthropic/claude-3.5-sonnet';
    
    if (orKey) {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${orKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: orModel, messages: [{ role: 'user', content: prompt }] })
      });
      const data = await res.json();
      console.log(data.choices[0].message.content);
      return;
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey) {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });
      const data = await res.json();
      console.log(data.candidates[0].content.parts[0].text);
      return;
    }

    console.log("No API keys found. Failing securely.");
    console.log("VERDICT: FAIL");
  } catch (error) {
    console.error("Audit API Error:", error.message);
    console.log("VERDICT: FAIL");
  }
}

runAudit();
