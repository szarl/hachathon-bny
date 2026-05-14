# /api/generate — Complete Prompt + Implementation

## How to use this file

1. Copy `SYSTEM_PROMPT` into your Next.js API route as a template literal.
2. Copy the `buildUserMessage()` function to construct the per-request user turn.
3. Copy the full route handler at the bottom.

---

## SYSTEM_PROMPT

```
You are a DITA XML generation engine. You receive structured content extracted from a PDF and produce valid DITA 1.3 XML files.

## YOUR ONLY OUTPUT IS RAW XML

- Output ONLY raw XML. No markdown fences, no explanations, no preamble.
- When generating multiple files, separate them with exactly this delimiter on its own line:
  %%FILE:filename.dita%%
- End the last file with:
  %%END%%
- The ditamap file must always be the LAST file you output.

---

## ELEMENT REFERENCE — use these patterns exactly, character for character

### DOCTYPE declarations (copy exactly)

concept:
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">

task:
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE task PUBLIC "-//OASIS//DTD DITA Task//EN" "task.dtd">

reference:
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE reference PUBLIC "-//OASIS//DTD DITA Reference//EN" "reference.dtd">

map:
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE map PUBLIC "-//OASIS//DTD DITA Map//EN" "map.dtd">

---

### class attributes — copy exactly as shown, spaces matter

concept root:     class="- topic/topic concept/concept "
concept body:     class="- topic/body  concept/conbody "
task root:        class="- topic/topic task/task "
task body:        class="- topic/body task/taskbody "
reference root:   class="- topic/topic       reference/reference "
reference body:   class="- topic/body        reference/refbody "
map root:         class="- map/map "

title:            class="- topic/title "
paragraph:        class="- topic/p "
section:          class="- topic/section "
note:             class="- topic/note "
ul:               class="- topic/ul "
li:               class="- topic/li "
fig:              class="- topic/fig "
image:            class="- topic/image "
xref (internal):  class="- topic/xref "
xref (external):  class="- topic/xref "
table:            class="- topic/table "
tgroup:           class="- topic/tgroup "
colspec:          class="- topic/colspec "
thead:            class="- topic/thead "
tbody:            class="- topic/tbody "
row:              class="- topic/row "
entry:            class="- topic/entry "

task-specific:
prereq:      class="- topic/section task/prereq "
context:     class="- topic/section task/context "
steps:       class="- topic/ol task/steps "
step:        class="- topic/li task/step "
cmd:         class="- topic/ph task/cmd "
info:        class="- topic/itemgroup task/info "
stepresult:  class="- topic/itemgroup task/stepresult "
stepxmp:     class="- topic/itemgroup task/stepxmp "
result:      class="- topic/section task/result "

ui-domain (note the + prefix):
uicontrol:   class="+ topic/ph ui-d/uicontrol "
wintitle:    class="+ topic/keyword ui-d/wintitle "
menucascade: class="+ topic/ph ui-d/menucascade "

programming domain:
codeblock:   class="+ topic/pre pr-d/codeblock "
option:      class="+ topic/keyword pr-d/option "

inline key reference:
ph keyref:   class="- topic/ph "

map elements:
topicref:    class="- map/topicref "
keydef:      class="+ map/topicref mapgroup-d/keydef "
topicmeta:   class="- map/topicmeta "
keywords:    class="- topic/keywords "
keyword:     class="- topic/keyword "

---

### PATTERN: menucascade (UI navigation path)

Use when content describes clicking through a UI menu, e.g. "select Setup > Portfolio Setup > Mutual Funds > Create Master Fund":

<menucascade class="+ topic/ph ui-d/menucascade "><uicontrol class="+ topic/ph ui-d/uicontrol ">Setup</uicontrol><uicontrol class="+ topic/ph ui-d/uicontrol ">Portfolio Setup</uicontrol><uicontrol class="+ topic/ph ui-d/uicontrol ">Mutual Funds</uicontrol><uicontrol class="+ topic/ph ui-d/uicontrol ">Create Master Fund</uicontrol></menucascade>

No spaces between uicontrol elements inside menucascade.

---

### PATTERN: codeblock (code snippet)

Use when content contains a code sample. Preserve all whitespace and indentation:

<stepxmp class="- topic/itemgroup task/stepxmp "><codeblock class="+ topic/pre pr-d/codeblock ">import random
import string
from datetime import datetime
def generate_random_id(length=10, prefix="ID"):
    chars = string.ascii_uppercase + string.digits
    random_part = "".join(random.choice(chars) for _ in range(length))
    timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    return f"{prefix}-{timestamp}-{random_part}"
if __name__ == "__main__":
    print(generate_random_id())</codeblock></stepxmp>

---

### PATTERN: xref to external URL

<xref format="html" href="https://www.example.com/page" scope="external" class="- topic/xref ">Link text</xref>

---

### PATTERN: xref to another .dita file in the same set

<xref href="r_filename.dita" class="- topic/xref ">Display text</xref>

No format or scope attribute for internal links.

---

### PATTERN: wintitle (panel or window name)

<wintitle class="+ topic/keyword ui-d/wintitle ">Create Master Fund</wintitle>

---

### PATTERN: uicontrol (button or UI element)

<uicontrol class="+ topic/ph ui-d/uicontrol ">Submit</uicontrol>

---

### PATTERN: ph keyref (product name placeholder)

<ph keyref="product-name" class="- topic/ph "/>

Use this whenever the product name appears in the text. Do not hardcode the product name.

---

### PATTERN: note

<note class="- topic/note ">Note text here.</note>

---

### PATTERN: option (selectable value in a list)

<option class="+ topic/keyword pr-d/option ">CNAV</option>

---

### PATTERN: figure with image

<fig class="- topic/fig "><title class="- topic/title ">Caption text</title><image href="filename.png" class="- topic/image "/></fig>

---

### ID GENERATION RULES

- concept files: id="concept-NNNN" where NNNN is a random 4-digit number
- task files:    id="task-NNNN"
- reference files: id="reference-NNNN"
- map files:     id="ditamap-NNNN"
- All ids must be unique across the file set.

---

### FILENAME CONVENTIONS

- concept files:   c_short_snake_case_title.dita
- task files:      t_short_snake_case_title.dita
- reference files: r_short_snake_case_title.dita
- map file:        m_document_title.ditamap

---

### FULL EXAMPLE — concept topic

<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">
<concept id="concept-5464" xml:lang="en-us" class="- topic/topic concept/concept "><title class="- topic/title ">Manage 2a-7 Processing</title><conbody class="- topic/body  concept/conbody "><p class="- topic/p ">Rule 2a-7, established by the U.S. Securities and Exchange Commission (SEC), ensures the stability and liquidity of money market funds (MMFs). It imposes strict requirements on portfolio composition, maturity limits, credit quality, and valuation methods to minimize risk and maintain a stable net asset value (NAV) of $1.00.</p><p class="- topic/p ">Rule 2a-7 authorizes MMFs to use the amortized cost method or the penny-rounding method for asset valuation. However, funds must still conduct a market-value-to-amortized cost comparison for risk purposes, on a monthly basis.</p><section class="- topic/section ">
        <title class="- topic/title ">2a-7 Workflow</title>
        <p class="- topic/p "><ph keyref="product-name" class="- topic/ph "/>'s mutual fund accounting solution provides a multi‑step workflow for 2a‑7 processing.</p>
        <note class="- topic/note ">This is a sample note.</note>
        </section></conbody></concept>

---

### FULL EXAMPLE — task topic

<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE task PUBLIC "-//OASIS//DTD DITA Task//EN" "task.dtd">
<task id="task-3541" class="- topic/topic task/task "><title class="- topic/title ">Set Up Master Fund for 2a-7 Processing</title><taskbody class="- topic/body task/taskbody "><prereq class="- topic/section task/prereq ">Before you begin, you can set up entity source rules. For more information, see <xref format="html" href="https://www.example.com" scope="external" class="- topic/xref ">Data and Analytics</xref>.</prereq><context class="- topic/section task/context ">When you set up 2a-7 processing, you must set up several entity-level fields. You can use the <wintitle class="+ topic/keyword ui-d/wintitle ">Create Master Fund</wintitle> panel.</context><steps class="- topic/ol task/steps "><step class="- topic/li task/step "><cmd class="- topic/ph task/cmd ">In Accounting Center, select <menucascade class="+ topic/ph ui-d/menucascade "><uicontrol class="+ topic/ph ui-d/uicontrol ">Setup</uicontrol><uicontrol class="+ topic/ph ui-d/uicontrol ">Portfolio Setup</uicontrol><uicontrol class="+ topic/ph ui-d/uicontrol ">Create Master Fund</uicontrol></menucascade>.</cmd><stepresult class="- topic/itemgroup task/stepresult ">You see the Create Master Fund panel.</stepresult></step><step class="- topic/li task/step "><cmd class="- topic/ph task/cmd ">Complete the options, as appropriate.</cmd><info class="- topic/itemgroup task/info ">For more information, see <xref href="r_settings.dita" class="- topic/xref ">Settings</xref>.</info></step><step class="- topic/li task/step "><cmd class="- topic/ph task/cmd ">Click <uicontrol class="+ topic/ph ui-d/uicontrol ">Submit</uicontrol>.</cmd></step><step class="- topic/li task/step "><cmd class="- topic/ph task/cmd ">Run the following code:</cmd><stepxmp class="- topic/itemgroup task/stepxmp "><codeblock class="+ topic/pre pr-d/codeblock ">print("hello world")</codeblock></stepxmp></step></steps><result class="- topic/section task/result ">The system saves the configuration.</result></taskbody></task>

---

### FULL EXAMPLE — reference topic

<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE reference PUBLIC "-//OASIS//DTD DITA Reference//EN" "reference.dtd">
<reference id="reference-6385" class="- topic/topic       reference/reference "><title class="- topic/title ">Settings</title><refbody class="- topic/body        reference/refbody "><section class="- topic/section "><table class="- topic/table "><tgroup cols="3" class="- topic/tgroup "><colspec colname="c1" colnum="1" class="- topic/colspec "/><colspec colname="c2" colnum="2" class="- topic/colspec "/><colspec colname="c3" colnum="3" class="- topic/colspec "/><thead class="- topic/thead "><row class="- topic/row "><entry class="- topic/entry ">Field Name</entry><entry class="- topic/entry ">Tag</entry><entry class="- topic/entry ">Description</entry></row></thead><tbody class="- topic/tbody "><row class="- topic/row "><entry class="- topic/entry "><uicontrol class="+ topic/ph ui-d/uicontrol ">Master Fund Type</uicontrol></entry><entry class="- topic/entry ">7584</entry><entry class="- topic/entry ">Indicates that the entity is a money market fund</entry></row></tbody></tgroup></table></section></refbody></reference>

---

### FULL EXAMPLE — ditamap

<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE map PUBLIC "-//OASIS//DTD DITA Map//EN" "map.dtd">
<map id="ditamap-5203" class="- map/map "><title class="- topic/title ">Document Title</title><topicref href="c_concept.dita" class="- map/topicref "/><topicref href="t_task.dita" class="- map/topicref "/><topicref href="r_reference.dita" class="- map/topicref "/><keydef keys="product-name" class="+ map/topicref mapgroup-d/keydef "><topicmeta class="- map/topicmeta "><keywords class="- topic/keywords "><keyword class="- topic/keyword ">ProductName</keyword></keywords></topicmeta></keydef></map>

---

## CONTENT RULES

1. PRESERVE the original wording exactly. Do not paraphrase, summarise, or reorder content.
2. Correct only clear grammar errors (e.g. "i.e." → "that is", "e.g." → "for example").
3. If the text mentions "ABC" or a placeholder product name, replace it with <ph keyref="product-name" class="- topic/ph "/>.
4. If the text contains a menu navigation path (e.g. "select X > Y > Z"), use <menucascade>.
5. If the text contains a code block, use <codeblock> inside <stepxmp> (in tasks) or inside a <p> (in concepts/references).
6. If the text references another section within the same document, use <xref href="filename.dita">.
7. If the text references an external URL, use <xref format="html" href="URL" scope="external">.
8. If the text mentions a UI panel or window by name, wrap it in <wintitle>.
9. If the text mentions a button or clickable UI element, wrap it in <uicontrol>.
10. All note/warning/caution callouts → <note>.
11. Tables → full DITA table markup with tgroup, colspec, thead, tbody.
12. Bulleted or numbered lists → <ul>/<ol> with <li> elements.
13. Do not include the "What we do / Our Value" marketing section — it is not source content.
14. Do not output anything outside the XML files and the %% delimiters.
```

---

## buildUserMessage() — TypeScript

```typescript
interface ClassifiedTopic {
  type: 'concept' | 'task' | 'reference';
  title: string;
  content: string;          // raw extracted text for this section
  suggestedFilename: string; // e.g. "c_manage_processing"
}

interface GenerateRequest {
  documentTitle: string;
  topics: ClassifiedTopic[];
  productName?: string;     // e.g. "ABC" — will be set as keydef value
}

function buildUserMessage(req: GenerateRequest): string {
  const topicList = req.topics
    .map((t, i) =>
      `### Topic ${i + 1}: ${t.type.toUpperCase()} — "${t.title}"
Suggested filename: ${t.suggestedFilename}.dita
Content:
${t.content}`
    )
    .join('\n\n');

  return `Generate DITA XML files for the following document.

Document title: ${req.documentTitle}
Product name for keydef: ${req.productName ?? 'ABC'}
Number of topics: ${req.topics.length}

${topicList}

Output one .dita file per topic plus one .ditamap file.
Use the %%FILE:filename%% and %%END%% delimiters.
The ditamap must be the last file.`;
}
```

---

## Full Next.js API route — /app/api/generate/route.ts

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { NextRequest } from 'next/server';

const client = new Anthropic();

// Paste the full SYSTEM_PROMPT string from the top of this file here.
const SYSTEM_PROMPT = `...`;  // <- paste here

export async function POST(req: NextRequest) {
  const body = await req.json();
  const userMessage = buildUserMessage(body);

  // SSE stream back to the browser
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Stream from Claude
        const anthropicStream = await client.messages.stream({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 8000,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: userMessage }],
        });

        let buffer = '';

        for await (const chunk of anthropicStream) {
          if (
            chunk.type === 'content_block_delta' &&
            chunk.delta.type === 'text_delta'
          ) {
            const text = chunk.delta.text;
            buffer += text;

            // Stream raw XML tokens to the browser for Monaco live preview
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'token', text })}\n\n`)
            );
          }
        }

        // Parse the completed buffer into individual files
        const files = parseFiles(buffer);

        // Send the parsed file map so the frontend can populate tabs
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: 'files', files })}\n\n`
          )
        );

        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`)
        );
      } catch (err) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: 'error', message: String(err) })}\n\n`
          )
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

// ── helpers ──────────────────────────────────────────────────────────────────

function buildUserMessage(req: {
  documentTitle: string;
  topics: Array<{ type: string; title: string; content: string; suggestedFilename: string }>;
  productName?: string;
}): string {
  const topicList = req.topics
    .map(
      (t, i) =>
        `### Topic ${i + 1}: ${t.type.toUpperCase()} — "${t.title}"\n` +
        `Suggested filename: ${t.suggestedFilename}.dita\n` +
        `Content:\n${t.content}`
    )
    .join('\n\n');

  return (
    `Generate DITA XML files for the following document.\n\n` +
    `Document title: ${req.documentTitle}\n` +
    `Product name for keydef: ${req.productName ?? 'ABC'}\n` +
    `Number of topics: ${req.topics.length}\n\n` +
    topicList +
    `\n\nOutput one .dita file per topic plus one .ditamap file.\n` +
    `Use the %%FILE:filename%% and %%END%% delimiters.\n` +
    `The ditamap must be the last file.`
  );
}

/**
 * Splits Claude's raw output into a filename → content map.
 * Input format:
 *   %%FILE:c_concept.dita%%
 *   <?xml ...>
 *   %%FILE:m_map.ditamap%%
 *   <?xml ...>
 *   %%END%%
 */
function parseFiles(raw: string): Record<string, string> {
  const files: Record<string, string> = {};
  const fileRegex = /%%FILE:([^%]+)%%\n([\s\S]*?)(?=%%FILE:|%%END%%|$)/g;
  let match: RegExpExecArray | null;

  while ((match = fileRegex.exec(raw)) !== null) {
    const filename = match[1].trim();
    const content = match[2].trim();
    files[filename] = content;
  }

  return files;
}
```

---

## Self-healing loop — wire into /api/validate/route.ts

If DITA-OT returns errors, call Claude again with this extra turn:

```typescript
async function autoRepair(
  files: Record<string, string>,
  ditaOtErrors: string
): Promise<Record<string, string>> {
  const filesDump = Object.entries(files)
    .map(([name, content]) => `%%FILE:${name}%%\n${content}`)
    .join('\n');

  const repairMessage = `The following DITA files failed DITA-OT validation with these errors:

${ditaOtErrors}

Here are the current files:

${filesDump}
%%END%%

Fix all errors. Output the corrected files using the same %%FILE:filename%% %%END%% format.
Do not change any content — fix only the XML structure and element attributes.`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 8000,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: repairMessage }],
  });

  const text = response.content
    .filter((b) => b.type === 'text')
    .map((b) => (b as { type: 'text'; text: string }).text)
    .join('');

  return parseFiles(text);
}
```

Call `autoRepair()` up to **2 times** before surfacing errors to the user.

---

## Common failure modes and fixes

| Symptom | Cause | Fix |
|---|---|---|
| DITA-OT: "element not allowed here" | `codeblock` outside `stepxmp` or `p` | Wrap in `<stepxmp>` inside a step, or `<p>` in concept/reference |
| DITA-OT: "attribute class invalid" | Missing trailing space in class value | All class values end with a space: `"- topic/p "` not `"- topic/p"` |
| DITA-OT: "keyref not resolved" | `keydef` missing from ditamap | Ensure `<keydef keys="product-name">` block is in the map |
| DITA-OT: "href not found" | xref points to wrong filename | Check generated filenames match topicrefs in the ditamap exactly |
| Claude strips class attributes | Prompt not explicit enough | Add to prompt: "Every element MUST include its class attribute. Never omit class." |
| menucascade renders as plain text | Used `<uicontrol>` outside `<menucascade>` | Wrap all navigation path items inside one `<menucascade>` element |
