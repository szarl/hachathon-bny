<!-- Source: DITA_Converter_PRD_Pack.docx.md -->

# PRD-14 — Main page layout and BNY branding

## **Summary**

Assemble all components into the main page layout with BNY-aligned branding: navy header, BNY logo, clean sans-serif typography, and a two-column layout for the progress indicator and Monaco editor.

## **Context**

Judges are from BNY. Matching their brand palette signals attention to detail. Spend 20 minutes maximum on this — functional correctness is more important than design polish.

## **Acceptance criteria**

| Criterion | Definition of done |
| :---- | :---- |
| Navy header | Header background is \#0C2340 (BNY navy). White text. BNY or hackathon title shown. |
| Two-column layout | Left column (40%): UploadZone \+ ProgressIndicator. Right column (60%): XmlEditor. |
| Responsive | On screens below 768px, columns stack vertically. |
| JobHistory below | Job history table is below the two-column section, full width. |
| Clean typography | Body font is Inter or system-ui. No Comic Sans, no decorative fonts. |
| Page title | \<title\> is "DITA Converter — BNY Hackathon 2026". |

## **Tasks**

92. Edit /app/page.tsx to assemble UploadZone, ProgressIndicator, XmlEditor, DownloadButton, JobHistory

93. Create /app/components/Header.tsx with navy background and title

94. Use Tailwind grid: grid-cols-1 md:grid-cols-5 for layout

95. Left col: md:col-span-2. Right col: md:col-span-3.

96. Pass useConversionStream state down to all components as props

97. Set document title in /app/layout.tsx

## **Notes**

| *BNY colour reference: Navy \#0C2340, Blue \#185FA5, Light blue \#E6F1FB. Do not spend more than 20 minutes on styling — a functional ugly tool beats a beautiful broken one.* |
| :---- |


