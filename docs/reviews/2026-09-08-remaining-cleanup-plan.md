# Remaining desktop — scoped cleanup plan

Scope: only this batch's changed files since `06a6923`: new study models/environment/remaining assembly/reflections/gallery/catalog, preview options, explicit factory refs, scene integration, their tests and result documents. No unrelated folders, dependencies, default visuals or interaction redesign.

Behavior lock: 210 unit tests and fresh release Gate; real desktop/gallery/failure browser scripts; both accepted-candidate screenshot sizes and the original-object screenshot compare pixel-identical to their pre-batch evidence. Full candidate passes Kimi visual-verdict 92.

Cleanup order (after architect approval):

1. Dead allocation: remove the environment helper's unused `shadowMaterial`, which is never attached to any paper shadow (those allocate their own material).
2. Ownership duplication: unify catalog desk teardown in one function for success/failure; ensure unused baseline materials are disposed on normal success as well as failure.
3. Type duplication: share catalog `GalleryItem`/`GalleryModel` declarations through type-only imports; retain the injectable viewer interface needed by lifecycle tests.
4. Teardown reinforcement: verify scene disposal is idempotent across pagehide and HMR; add a guard/test if needed without altering live interactions.
5. Run targeted tests after each pass, then full release Gate and real-browser regression again. Visual output must remain pixel-identical to v4.

Fallback inventory:

- Full-candidate failed import retains existing visuals and logs a warning + unavailable marker: grounded preview compatibility/fail-safe, covered by injected network failure and lifecycle tests; preserve.
- Gallery catalog/init failure reload retry and per-model retry: explicit boundary recovery, covered by lifecycle tests and browser GLB retry; preserve.
- Late model generation tokens and GLB lease release: lifetime protection, not a masking fallback; preserve.
- Existing default no-query/legacy query variants: explicitly required comparison compatibility; preserve.

No broad fallback ambiguity requiring a new plan. Architect reviews implementation and this bounded cleanup proposal independently; parent owns execution and post-cleanup evidence.

## Execution result

All four scoped passes completed. New disposal tests first reproduced both the unused-material gap and repeated teardown, then passed with the fixes. The first full check also caught an overly narrow spy type in the new test; the test now retains typed material references and checks their disposal directly.

Final post-cleanup Gate: 211 tests / 42 files, check/build/assets/models/release pass. All four real-browser regression scripts were rerun against that successful build. Both final screenshot sizes are byte-for-byte equal in decoded RGBA channels to the Kimi-reviewed v4 images. Architect re-review: APPROVE/CLEAR. No dependency or unrelated source changes.
