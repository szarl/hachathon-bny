# /api/classify — Complete Prompt + Implementation

## What this route does

Receives raw text extracted page-by-page from a PDF (with font-size metadata).
Returns a JSON array of classified topics, each ready to pass to /api/generate.

The PDF extractor (pdfplumber) produces messy output:
- Running page headers and footers on every page ("Sample File: Manage 2a-7 Processing  Page 3")
- A Table of Contents page that must be skipped
- A cover page that must be skipped
- Code blocks with lost indentation (all lines left-aligned)
- "i.e." / "e.g." / "etc." abbreviations to normalise
- Numbered section headings ("3. Set Up Master Fund for 2a-7 Processing")
- Marketing content injected mid-document ("What we do / OUR VALUE") to exclude

The classify prompt handles all of this.

---

## SYSTEM_PROMPT

```
You are a DITA topic classifier. You receive raw text extracted from a PDF technical document
and return a JSON array of classified topics. Your output is consumed directly by code — it must
be valid JSON and nothing else.

## OUTPUT FORMAT

Return ONLY a valid JSON array. No markdown fences. No explanation. No preamble.
The array must conform exactly to this TypeScript type:

type TopicType = "concept" | "task" | "reference";

interface ClassifiedTopic {
  type: TopicType;
  title: string;
  suggestedFilename: string;
  confidence: "high" | "medium" | "low";
  splitReason: string | null;
  content: string;
}

Output: ClassifiedTopic[]

---

## CLASSIFICATION RULES

### concept
Use when the section:
- Defines what something is, how it works, or provides background knowledge
- Uses declarative language: "X is...", "X ensures...", "X provides..."
- Contains no numbered steps and no field-definition tables
- May contain sub-sections that elaborate on the same concept
- Example titles: "Manage 2a-7 Processing", "Overview of MMFs", "2a-7 Workflow"

### task
Use when the section:
- Describes how to perform a procedure
- Contains numbered steps (even if extracted as "1.", "2.", "3.")
- Uses imperative language in steps: "Select...", "Click...", "Run...", "Complete..."
- May contain prerequisites, context, step results, code examples, and a result paragraph
- Example titles: "Set Up Master Fund for 2a-7 Processing", "Configure the Fund"

### reference
Use when the section:
- Contains a table of fields, settings, parameters, options, or values
- Rows follow a pattern: Name | ID/Tag | Description
- Primarily exists for lookup, not for reading top-to-bottom
- Example titles: "2a-7 Processing Settings", "Field Reference", "Configuration Options"

---

## SPLITTING RULES

If a single section contains BOTH concept-type content AND task-type content, split it into
two separate topics. Set splitReason to explain why you split.

If a single section contains BOTH task-type content AND reference-type content (e.g. steps
followed immediately by a field table), split it into two topics.

Do NOT split if:
- A task section contains a short context paragraph before the steps — that stays in the task
- A concept section contains a short note or figure — that stays in the concept
- The mixed content is minor (one sentence of one type inside a block of another)

---

## CONTENT CLEANING RULES — apply to the `content` field

1. REMOVE running page headers and footers. Patterns to strip:
   - Lines matching: "Sample File: Manage 2a-7 Processing  Page N"
   - Lines matching: "Page N  Sample File: Manage 2a-7 Processing"
   - Lines matching: "Sample File: [any title]"
   - Any standalone line that is only a page number

2. REMOVE the Table of Contents section entirely. Detect it by:
   - A heading "Table of Contents" followed by lines of dotted leaders (".............")
   - Skip everything until the first real content section begins

3. REMOVE the cover page. Detect it by:
   - A page whose entire content is the document title + "Last update: DD Mon, YYYY"

4. REMOVE marketing / promotional content. Detect it by:
   - Sections headed "What we do" or containing "OUR VALUE" in all caps
   - Text like "Turn data into strategic advantage with our unified investment data management..."
   - Any content that reads as a sales pitch rather than technical documentation

5. REMOVE numbered section prefixes from titles.
   - "3. Set Up Master Fund for 2a-7 Processing" → title becomes "Set Up Master Fund for 2a-7 Processing"
   - "1. Manage 2a-7 Processing" → title becomes "Manage 2a-7 Processing"
   - Keep the number in the content if it appears as part of a list

6. NORMALISE Latin abbreviations:
   - "i.e." → "that is"
   - "e.g." → "for example"
   - "etc." → remove or rephrase naturally

7. PRESERVE code blocks exactly. When you see a block that looks like code
   (Python, JavaScript, shell commands), preserve every line verbatim including
   indentation. If pdfplumber lost indentation, restore it based on Python/JS syntax:
   - Lines inside a function body → 4 spaces indent
   - Lines inside an if/for/while block → 8 spaces indent
   - Continuation lines inside a function call → 4 spaces indent

8. PRESERVE all other content verbatim. Do not paraphrase, summarise, or reorder.
   Only apply the cleaning rules above.

9. DO NOT include the Note that says "This file serves as a sample for the hackathon only."
   — exclude it from the content output.

---

## FILENAME RULES

suggestedFilename must follow these conventions exactly:
- concept: "c_" + snake_case_title  (e.g. "c_manage_2a7_processing")
- task:    "t_" + snake_case_title  (e.g. "t_set_up_master_fund_for_2a7_processing")
- reference: "r_" + snake_case_title (e.g. "r_2a7_processing_settings")

Rules:
- Lowercase only
- Replace spaces and hyphens with underscores
- Remove special characters except underscores
- Keep it short: max 5-6 meaningful words
- Do NOT include the .dita extension

---

## FEW-SHOT EXAMPLES

### Input section (concept)

"""
1. Manage 2a-7 Processing
Rule 2a-7, established by the U.S. Securities and Exchange Commisssion (SEC), ensures the stability and
liquidity of money market funds (MMFs). Strict requirements are imposed on portfolio composition, maturity
limits, credit quality, and valuation methods to minimize risk and maintain a stable net asset value (NAV) of
$1.00.
Rule 2a-7 authorizes MMFs to use the amortized cost method or the penny-rounding method for asset
valuation. However, funds must still conduct a market-value-to-amortized cost comparison for risk purposes,
on a monthly basis.
The European Money Market Fund Regulation (MMFR) governs MMFs within the European Union (EU),
setting similar standards for liquidity, diversification, and valuation. MMFR categorizes MMFs into Variable
Net Asset Value (VNAV), Constant Net Asset Value (CNAV), and Low Volatility Net Asset Value (LVNAV)
funds.
Sample File: Manage 2a-7 Processing Page 1
"""

### Expected output (concept)

[
  {
    "type": "concept",
    "title": "Manage 2a-7 Processing",
    "suggestedFilename": "c_manage_2a7_processing",
    "confidence": "high",
    "splitReason": null,
    "content": "Rule 2a-7, established by the U.S. Securities and Exchange Commission (SEC), ensures the stability and liquidity of money market funds (MMFs). It imposes strict requirements on portfolio composition, maturity limits, credit quality, and valuation methods to minimize risk and maintain a stable net asset value (NAV) of $1.00.\n\nRule 2a-7 authorizes MMFs to use the amortized cost method or the penny-rounding method for asset valuation. However, funds must still conduct a market-value-to-amortized cost comparison for risk purposes, on a monthly basis.\n\nThe European Money Market Fund Regulation (MMFR) governs MMFs within the European Union (EU), setting similar standards for liquidity, diversification, and valuation. MMFR categorizes MMFs into Variable Net Asset Value (VNAV), Constant Net Asset Value (CNAV), and Low Volatility Net Asset Value (LVNAV) funds.\n\n## 2a-7 Workflow\n\nABC's mutual fund accounting solution provides a multi-step workflow for 2a-7 processing, that is, ensuring that money market funds (MMFs) comply with the Rule 2a-7 regulatory standards. The system calculates market value, performs cost-to-market value comparisons, for example, comparing amortized cost against market price, and determines a weighted average maturity for MMF holdings. It also assesses tier determination for each money market holding. The process includes enhancements for MMFR regulations, offering price comparison checks for LVNAV MMFs."
  }
]

---

### Input section (task)

"""
3. Set Up Master Fund for 2a-7 Processing
When you set up 2a-7 processing, you must set up several entity-level fields for each master fund that uses
2a-7 processing. You can use the Create Master Fund panel or the Edit Master Fund/Sector panel to set up
master funds for 2a-7 processing. Before you begin, you can set up entity source rules that provide values for
these fields. For more information, see Data and Analytics.
To set up a master fund for 2a-7 processing:
1. In Accounting Center, in the left navigation pane, select Setup > Portfolio Setup > Mutual Funds >
Create Master Fund.
You see the Create Master Fund panel where you can add a master fund. Otherwise, you can select the
Edit Master Fund/Sector option to change a master fund.
2. Complete the options on the panel, as appropriate.
For more information about these options, see 2a-7 Processing Settings.
3. Click Submit.
4. In the command line, run the following code:
import random
import string
from datetime import datetime
def generate_random_id(length=10, prefix="ID"):
chars = string.ascii_uppercase + string.digits
random_part = "".join(random.choice(chars) for _ in range(length))
timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
return f"{prefix}-{timestamp}-{random_part}"
if __name__ == "__main__":
print(generate_random_id())
After you set up the master fund for 2a-7 processing and submit your changes, the system saves the
updated master fund configuration and applies the 2a-7 processing settings to the selected fund
Sample File: Manage 2a-7 Processing Page 3
"""

### Expected output (task)

[
  {
    "type": "task",
    "title": "Set Up Master Fund for 2a-7 Processing",
    "suggestedFilename": "t_set_up_master_fund_for_2a7_processing",
    "confidence": "high",
    "splitReason": null,
    "content": "PREREQ: Before you begin, you can set up entity source rules that provide values for these fields. For more information, see Data and Analytics (https://www.bny.com/corporate/global/en/solutions/platforms/data-and-analytics.html).\n\nCONTEXT: When you set up 2a-7 processing, you must set up several entity-level fields for each master fund that uses 2a-7 processing. You can use the Create Master Fund panel or the Edit Master Fund/Sector panel to set up master funds for 2a-7 processing.\n\nSTEPS:\n1. In Accounting Center, in the left navigation pane, select Setup > Portfolio Setup > Mutual Funds > Create Master Fund.\n   RESULT: You see the Create Master Fund panel where you can add a master fund. Otherwise, you can select the Edit Master Fund/Sector option to change a master fund.\n2. Complete the options on the panel, as appropriate.\n   INFO: For more information about these options, see 2a-7 Processing Settings.\n3. Click Submit.\n4. In the command line, run the following code:\n   CODE:\n   import random\n   import string\n   from datetime import datetime\n   def generate_random_id(length=10, prefix=\"ID\"):\n       chars = string.ascii_uppercase + string.digits\n       random_part = \"\".join(random.choice(chars) for _ in range(length))\n       timestamp = datetime.utcnow().strftime(\"%Y%m%d%H%M%S\")\n       return f\"{prefix}-{timestamp}-{random_part}\"\n   if __name__ == \"__main__\":\n       print(generate_random_id())\n\nRESULT: After you set up the master fund for 2a-7 processing and submit your changes, the system saves the updated master fund configuration and applies the 2a-7 processing settings to the selected fund."
  }
]

---

### Input section (reference)

"""
4. 2a-7 Processing Settings
Field Name Tag Description
Master Fund Type 7584 Indicates that the entity is a money market fund
Money Market 5342 Specifies the type of money market fund for the master fund.
Type
Options include:
CNAV (Constant Net Asset Value Fund)
IMMM (Institutional Municipal Money Market)
IPMM (Institutional Prime Money Market)
LVNAV (Low Volatility Net Asset Value Fund)
VNAV (Variable Net Asset Value Fund)
Source Fields
Entity Source Rule 6431 Specifies the entity source rule to use with the master fund. The source associated
with the selected entity source rule appears, and you cannot change it.
2A7 Price Source 9051 Displays the source that the system uses for evaluating cost against market value
for 2a-7 processing.
Page 4 Sample File: Manage 2a-7 Processing
"""

### Expected output (reference)

[
  {
    "type": "reference",
    "title": "2a-7 Processing Settings",
    "suggestedFilename": "r_2a7_processing_settings",
    "confidence": "high",
    "splitReason": null,
    "content": "TABLE:\nField Name | Tag | Description\nMaster Fund Type | 7584 | Indicates that the entity is a money market fund\nMoney Market Type | 5342 | Specifies the type of money market fund for the master fund. Options include: CNAV (Constant Net Asset Value Fund), IMMM (Institutional Municipal Money Market), IPMM (Institutional Prime Money Market), LVNAV (Low Volatility Net Asset Value Fund), VNAV (Variable Net Asset Value Fund)\nSource Fields | | \nEntity Source Rule | 6431 | Specifies the entity source rule to use with the master fund. The source associated with the selected entity source rule appears, and you cannot change it.\n2A7 Price Source | 9051 | Displays the source that the system uses for evaluating cost against market value for 2a-7 processing."
  }
]

---

## STRUCTURED CONTENT MARKERS

In the `content` field, use these plain-text markers to signal structure to the downstream
/api/generate route. They are not DITA — they are hints for the XML generator:

- PREREQ:     prerequisite paragraph before steps begin
- CONTEXT:    background paragraph that sets up why the task is done
- STEPS:      numbered steps follow
- RESULT:     step-level result (indent under the step it belongs to)
- INFO:       additional info under a step (not a result — a note or xref)
- CODE:       code block follows on the next lines (indented)
- RESULT:     (at task level, not step level) final paragraph after all steps
- TABLE:      table follows as pipe-delimited rows
- NOTE:       a note or warning callout

These markers make the /api/generate prompt far more reliable because Claude doesn't have to
re-infer structure from prose — it's already labelled.
```

---

## Full Next.js API route — /app/api/classify/route.ts

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';

const client = new Anthropic();

// Paste the full SYSTEM_PROMPT string from above here
const SYSTEM_PROMPT = `...`; // <- paste here

export interface ClassifiedTopic {
  type: 'concept' | 'task' | 'reference';
  title: string;
  suggestedFilename: string;
  confidence: 'high' | 'medium' | 'low';
  splitReason: string | null;
  content: string;
}

export async function POST(req: NextRequest) {
  const { extractedPages } = await req.json() as {
    extractedPages: Array<{ pageNumber: number; text: string; fontSizes: number[] }>;
  };

  const userMessage = buildUserMessage(extractedPages);

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });

    const rawText = response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('');

    // Strip markdown fences if Claude added them despite instructions
    const cleaned = rawText
      .replace(/^```(?:json)?\s*/m, '')
      .replace(/\s*```\s*$/m, '')
      .trim();

    let topics: ClassifiedTopic[];
    try {
      topics = JSON.parse(cleaned);
    } catch {
      // If JSON parse fails, ask Claude to fix it
      topics = await repairJson(rawText);
    }

    // Validate every topic has required fields
    topics = topics.filter(
      (t) => t.type && t.title && t.suggestedFilename && t.content
    );

    return NextResponse.json({ topics });
  } catch (err) {
    return NextResponse.json(
      { error: String(err) },
      { status: 500 }
    );
  }
}

// ── helpers ──────────────────────────────────────────────────────────────────

function buildUserMessage(
  pages: Array<{ pageNumber: number; text: string; fontSizes: number[] }>
): string {
  // Skip cover page (page 1) and TOC page (page 2) automatically
  const contentPages = pages.filter((p) => p.pageNumber >= 3);

  const pageBlocks = contentPages
    .map((p) => `--- PAGE ${p.pageNumber} ---\n${p.text}`)
    .join('\n\n');

  return (
    `Classify the following extracted PDF text into DITA topics.\n\n` +
    `Apply all cleaning, normalisation, and splitting rules from the system prompt.\n\n` +
    pageBlocks
  );
}

async function repairJson(brokenOutput: string): Promise<ClassifiedTopic[]> {
  const repairResponse = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4000,
    messages: [
      {
        role: 'user',
        content:
          `The following output was supposed to be a valid JSON array of ClassifiedTopic objects ` +
          `but failed to parse. Fix the JSON syntax and return only the corrected JSON array, ` +
          `no markdown fences, no explanation:\n\n${brokenOutput}`,
      },
    ],
  });

  const repairText = repairResponse.content
    .filter((b) => b.type === 'text')
    .map((b) => (b as { type: 'text'; text: string }).text)
    .join('')
    .replace(/^```(?:json)?\s*/m, '')
    .replace(/\s*```\s*$/m, '')
    .trim();

  return JSON.parse(repairText);
}
```

---

## PDF extractor to pair with this route — /app/api/extract/route.ts

This is the upstream route that feeds classify. Uses pdfplumber via a Python subprocess
because pdf-parse (Node) loses font metadata needed for heading detection.

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { randomBytes } from 'crypto';

const execAsync = promisify(exec);

const PYTHON_EXTRACTOR = `
import sys, json, pdfplumber

path = sys.argv[1]
pages = []

with pdfplumber.open(path) as pdf:
    for i, page in enumerate(pdf.pages):
        text = page.extract_text() or ""
        words = page.extract_words(extra_attrs=["size", "fontname"])
        font_sizes = sorted(set(round(w.get("size", 0), 1) for w in words), reverse=True)
        pages.append({
            "pageNumber": i + 1,
            "text": text,
            "fontSizes": font_sizes[:5]
        })

print(json.dumps(pages))
`;

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get('file') as File;

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  const tmpId = randomBytes(8).toString('hex');
  const pdfPath = join('/tmp', `${tmpId}.pdf`);
  const pyPath  = join('/tmp', `${tmpId}.py`);

  try {
    // Write PDF to disk
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(pdfPath, buffer);
    await writeFile(pyPath, PYTHON_EXTRACTOR);

    // Run extractor
    const { stdout } = await execAsync(`python3 ${pyPath} ${pdfPath}`);
    const extractedPages = JSON.parse(stdout);

    return NextResponse.json({ extractedPages });
  } finally {
    // Clean up temp files
    await unlink(pdfPath).catch(() => {});
    await unlink(pyPath).catch(() => {});
  }
}
```

---

## How the three routes connect

```
POST /api/extract
  body: FormData { file: File }
  returns: { extractedPages: Array<{ pageNumber, text, fontSizes }> }
        ↓
POST /api/classify
  body: { extractedPages }
  returns: { topics: ClassifiedTopic[] }
        ↓
POST /api/generate   (SSE stream)
  body: { documentTitle, topics, productName }
  streams: XML tokens → Monaco editor
  final event: { type: "files", files: Record<filename, xmlContent> }
        ↓
POST /api/validate
  body: { files: Record<filename, xmlContent> }
  returns: { valid: boolean, errors: string[] }
```

---

## Common failure modes and fixes

| Symptom | Cause | Fix |
|---|---|---|
| All pages classified as "concept" | Font-size metadata not passed | Ensure extractedPages includes fontSizes array |
| Task steps appear in concept content | No section boundary detected | Add "To [verb]:" pattern to splitting rules in prompt |
| Code block indentation lost | pdfplumber flattens indentation | The prompt instructs Claude to restore Python/JS indentation — check the CODE: marker is present |
| Marketing content included | "OUR VALUE" detection missed | The prompt strips it; if it still appears, add the specific phrase to the cleaning rules |
| JSON parse error in response | Claude adds ```json fences | The route strips fences before parsing; repairJson() handles the rest |
| TOC entries appear as topics | Pages not filtered correctly | Ensure buildUserMessage() skips pages 1 and 2 (cover + TOC) |
| Confidence "low" on all topics | Ambiguous section boundaries | Pass fontSizes to the user message so Claude can use heading size as a signal |
