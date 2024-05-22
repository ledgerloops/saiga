# LedgerLoops Saiga

This repository contains one of the strategies from Strategy Pit, Saiga.
It is a miminal LedgerLoops node that implements DLD, greedy lift negotiation, and cooperative lift resolution.

It will support different P2P messaging networks to implement communication between nodes.

```
deno run -A src/run.ts
```

If you want to try out the [Earthstar](https://earthstar-project.org/) transport for messaging ([not working yet](https://github.com/ledgerloops/saiga/issues/1)!) do this instead:

```
deno run -A src/run-earthstar.ts
```
