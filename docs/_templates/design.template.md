# Design Contract — <initiative title>

- **Slug:** <slug>
- **Source spec:** docs/product/<slug>-product-spec.md · docs/architecture/<slug>/spec.md
- **Target platforms:** <web / iOS / Flutter — only those in AGENTS.md §5>
- **Design system:** <existing system/tokens reused, or "none yet — this establishes it">

> Written by the designer, implemented by the client agents. A contract, not an essay: every
> UI-bearing story in the product spec must be covered precisely enough to build without guessing.

## Flows
<For each UI-bearing story: entry point → steps → exit. Cite the story ID.>

## Screens
### <Screen name>
- **Serves:** <story ID(s) / AC>
- **Layout:** <structure, hierarchy, key regions — precise enough to build>
- **Components:** <reused components/tokens; anything new, defined here>
- **States:** <default · empty · loading · error — all four, per screen>
- **Interaction & motion:** <triggers, transitions, feedback>
- **RTL / i18n:** <mirroring, text expansion, locale specifics per AGENTS.md §4>

## Tokens
<Color / type / spacing used — reference the design system; list only deltas/new tokens.>

## Per-platform divergence
| Concern | Web | iOS | Flutter |
|---|---|---|---|
| <where platforms must differ — navigation idiom, gestures, system components> | … | … | … |

## Open Questions
<Product decisions the designer cannot make — bubbled to the orchestrator to relay. Empty at gate time.>
