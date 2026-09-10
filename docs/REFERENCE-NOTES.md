# Reference synthesis

- **Dream Textures**: output-driven node execution, per-render cache, cancellation callback, frontend/backend actor process, backend API, history/import-export ideas.
- **Stable-text arena candidates**: evidence-backed denoising, generic-vs-conditioned delta, strength as mutation budget, edit-mask/inpainting, residual queue, hard/soft constraints.
- **Tiny Actor System + Kotlin actor runtime**: sequential mailbox, encapsulated mutable state, behavior/state transitions, machine as sole writer.
- **Logical state clock**: monotonic event clock + hash-chained transition record.
- **go-markitdown**: normalization boundary for PDF/DOCX/XLSX/HTML into Markdown.
- **files-to-prompt / code2prompt / ingest**: scoped context gathering, gitignore/filtering, source trees, token-aware prompt packing; intentionally complementary rather than reimplemented wholesale.
- **gllm**: prompt templates, model routing, session continuity, command-agent ergonomics; STF remains provider-agnostic and lets OpenCode own model/provider execution.
- **Charm**: user-owned encrypted/syncable storage and self-hosting concepts. Original repository is archived; no production dependency.
- **Bubble Tea / Lip Gloss Kanban references**: reserved for a future TUI that visualizes candidates as lanes and phase transitions as engine events.
- **Q-table/vector references**: deliberately not in v0.1 control authority. Evaluation data can later tune schedule defaults, but learned policy must not silently override hard anchors/user gates.
