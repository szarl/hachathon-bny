<!-- Source: DITA_Converter_PRD_Pack.docx.md -->

# PRD-11 — 5-stage progress indicator

## **Summary**

Build the visual 5-step progress indicator that maps conversion state to clearly labelled stages, with the Agent 2 validation badge showing issue count or pass status.

## **Context**

Reads from useConversionStream state. This component is the primary visual feedback during conversion and is the centrepiece of the demo.

## **Acceptance criteria**

| Criterion | Definition of done |
| :---- | :---- |
| 5 stages shown | Steps: Extracting PDF | Classifying topics | Agent 1 generating | Agent 2 validating | Complete. |
| Active stage highlighted | Current stage has a blue indicator dot and the label is bold. |
| Completed stages marked | Past stages show a green check mark. |
| Validation badge | During/after step 4: shows amber "Fixed N issues" or green "All checks passed". |
| Issues expandable | Clicking the amber badge expands a list showing each issue: file, rule, fix. |
| Error state | If state.stage \=== "error", a red banner shows state.error. |

## **Tasks**

74. Create /app/components/ProgressIndicator.tsx

75. Define the 5 steps as a static array with stage keys matching ConversionState.stage values

76. Map state.stage to the active step index

77. Render validation badge conditionally when state.validationIssues.length \> 0 or state.validationPassed \=== true

78. Implement expandable issues list with a toggle

79. Show each issue as: file (mono) | rule name | fix description

## **Notes**

| *The validation issues list is the most impressive UI element for judges. Make it clearly visible — not hidden behind a tiny toggle. Show it expanded by default when issuesFixed \> 0\.* |
| :---- |


