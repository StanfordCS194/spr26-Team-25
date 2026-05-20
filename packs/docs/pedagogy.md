# Pedagogy

A pack's `promptTemplate`, `levels`, and `goals` together encode how the tutor teaches. This document covers how to write them so the tutor actually teaches, rather than producing plausible-sounding language fragments.

## The single system prompt

Chronos sends one system prompt per turn. There is no chain-of-thought scratchpad, no separate teacher persona vs. examiner persona, no agent-of-agents pattern. Whatever pedagogy the tutor exhibits has to be in that one string.

Practical implication: the prompt template is the highest-leverage code in the pack. A great dictionary with a generic prompt produces a mediocre tutor. A modest dictionary with a sharp prompt produces a good tutor.

## Three things every prompt template should do

### 1. State who the tutor is, in one sentence

```
You are {tutor.name}, an expert {displayName} tutor with deep knowledge of...
```

The Greek pack opens this way. The line is mundane but it does two things: anchors the model's persona, and gives the learner something to refer to ("Chronos, can you explain...").

### 2. Surface the learner profile and adapt to it

The current learner profile (level, goal, time commitment) should appear literally in the prompt:

```
LEARNER PROFILE:
- Level: {learner.level}
- Goal: {learner.goal}
- Time commitment: {learner.time_commitment}
```

Then have pedagogy switch on it. Two equivalent styles:

**Inline menu style** (Greek pack): enumerate all levels and goals as literal prose. The model picks based on the learner profile values shown above.

**Selected-only style** (Nahuatl/Ojibwe packs): use `{level.guidance}` and `{goal.guidance}` to inject only the relevant pedagogical guidance.

The inline menu style produces longer prompts but lets the model implicitly compare ("this learner is intermediate, not beginner, so I should..."). The selected-only style is leaner. Both work; pick based on whether you want the model to see the alternative paths or not.

### 3. End with concrete behavior rules

```
ALWAYS:
- Introduce new {displayName} words in this format: ...
- Gently correct mistakes by restating the correct form before explaining why
- End each response with one question or exercise to keep the learner engaged
- Keep responses focused and digestible — do not overwhelm the learner
- Never break character as a knowledgeable, encouraging tutor
```

Rules at the end of the prompt are obeyed more reliably than rules at the start (recency effect in LLMs). Use this — put your most-important behaviors last.

## Writing `levels[].guidance`

These strings become *instructions* to the model when a level is selected. Write them as instructions, not as descriptions:

Bad: `"beginner: A student who knows nothing about the language."`

Good: `"Start with the alphabet and pronunciation. Introduce 2-3 new words per response. Use transliteration alongside native script. Explain grammar simply with analogies."`

The Greek pack's level guidance is a solid reference. Each entry says (a) what to assume the learner knows, (b) how many new things to introduce per turn, (c) what register to use, (d) what to connect to.

## Writing `goals[].guidance`

Same principle as levels, but with one extra responsibility: differentiate. Two goals on the same language should produce visibly different tutor behavior. If "general curiosity" and "academic coursework" produce the same prompts, the goal dimension isn't earning its place.

Cross-check: read your goals back. Could a learner predict which one they'd be assigned based on the guidance? If not, sharpen.

## Anti-patterns

### Overstuffed rules lists

A prompt with 30 ALWAYS rules and 30 NEVER rules is worse than one with 5 of each. The model can hold ~5-10 explicit constraints clearly; beyond that, individual rules dilute. Cut to the load-bearing ones.

### Pedagogy-by-meta-instruction

Don't write `"Be pedagogically appropriate."` The model already wants to be helpful; this instruction does nothing. Replace with concrete behaviors: `"After introducing a word, quiz the learner on it before moving on."`

### Forgetting that the dictionary is in scope

If your pack has `grounding.policy: "strict"`, your prompt template MUST tell the model so. The pack format doesn't enforce strict behavior by magic — the policy field is documentation; the actual enforcement is in your prompt's prose. The Ojibwe pack's prompt template includes:

```
DICTIONARY (authoritative — do not extrapolate beyond these entries):
{dictionary_context}
```

and ends with:

```
- If asked about a word not in the dictionary, say: "{grounding.uncertaintyPhrase}"
- Never invent {displayName} words or extrapolate beyond the dictionary.
```

Both halves matter. The first introduces the dictionary as authority; the second tells the model what to do when something falls outside it.

### Inventing pedagogical claims

If you don't know whether your language is taught alphabet-first vs. greetings-first vs. immersion-first by competent teachers, don't invent. Look at how the language is actually taught in respected programs and borrow from them. Pack pedagogy that contradicts established practice is a worse harm than no pack at all — it teaches learners wrong habits that fluent speakers will then have to undo.

## A worked example

Ancient Greek today (in chat.py) uses this pedagogy structure:

1. Identity + persona (1 paragraph).
2. Learner profile (3 lines).
3. Level-conditioned approach (3 levels enumerated).
4. Goal-conditioned approach (4 goals enumerated).
5. ALWAYS rules (5 items).

For Ojibwe, the same structure produces something different because:

- Levels are 2, not 3 (the dictionary is too small to support an "advanced" tier honestly).
- Goals are 3, focused on real motivations (ancestral connection, linguistic study, everyday speech).
- The dictionary-context placeholder is mandatory in the prompt.
- The uncertainty phrase is invoked explicitly.

The shape is the same; the contents are language-specific. That's the design.

## Testing your prompt

For Phase 5, the `repl` CLI command lets you talk to the tutor with your composed prompt:

```
ANTHROPIC_API_KEY=... python3 -m language_pack repl <your-id>
```

What to check:

- The tutor stays in character across turns.
- Vocabulary is introduced in your specified format.
- Mistakes get corrected the way you specified.
- (For strict-grounded packs) Asking about out-of-dictionary content triggers `uncertaintyPhrase`, not a confident fabrication.

If any of these fail, the fix is almost always in the prompt template, not in the model. Edit, validate, repl, iterate.
