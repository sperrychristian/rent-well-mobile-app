# API (replaced)

Rent Well no longer has its own server. In milestone 2 the Firebase Realtime Database, used through
its REST endpoints, became the app's only backend.

- The data model (every node, its key, its fields, and who reads and writes it) is in
  [data-model.md](data-model.md), with the diagram in [data-model.png](data-model.png).
- Every database call goes through `util/http.js` and the resource modules in `util/data/`.
- Setup steps are in [firebase-setup.md](firebase-setup.md).

Some code comments still say "docs/API.md" when they describe a rule (a status name, an error code,
or a money rule). Those rules now live in the app's own pure modules, which the Firebase data layer
reuses, so the comments still describe how the app behaves.
