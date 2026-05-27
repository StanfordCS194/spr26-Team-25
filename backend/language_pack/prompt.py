"""Compose a system prompt from a pack + a learner profile.

Placeholder substitution operates on pack.promptTemplate. Supported:

    {tutor.name}, {tutor.personaShort}
    {displayName}, {displayNameLocal}
    {learner.level}, {learner.goal}, {learner.time_commitment}
    {level.guidance}              guidance string for the selected level
    {goal.guidance}               guidance string for the selected goal
    {levels_menu}                 rendered list of all levels
    {goals_menu}                  rendered list of all goals
    {vocabulary.lineFormat}
    {grounding.uncertaintyPhrase}
    {dictionary_context}          injected by grounding.materialize

Unknown placeholders are left literal (no exception). This lets pack authors
include `{` braces verbatim without escaping.
"""

from __future__ import annotations

from typing import Optional

from .grounding import materialize_dictionary_context
from .models import LanguagePack, LearnerProfile


def compose(pack: LanguagePack, learner: LearnerProfile) -> str:
    """Return the fully substituted system prompt."""
    selected_level = _find_by_id(pack.levels, learner.level)
    selected_goal = _find_by_id(pack.goals, learner.goal) or _find_by_label(pack.goals, learner.goal)

    substitutions = {
        "{tutor.name}": pack.tutor.name,
        "{tutor.personaShort}": pack.tutor.personaShort,
        "{displayName}": pack.displayName,
        "{displayNameLocal}": pack.displayNameLocal or pack.displayName,
        "{learner.level}": learner.level,
        "{learner.goal}": learner.goal,
        "{learner.time_commitment}": learner.time_commitment,
        "{level.guidance}": selected_level.guidance if selected_level else "",
        "{goal.guidance}": selected_goal.guidance if selected_goal else "",
        "{levels_menu}": _render_levels_menu(pack),
        "{goals_menu}": _render_goals_menu(pack),
        "{vocabulary.lineFormat}": pack.vocabulary.lineFormat or "",
        "{grounding.uncertaintyPhrase}": pack.grounding.uncertaintyPhrase,
        "{dictionary_context}": materialize_dictionary_context(pack),
    }

    out = pack.promptTemplate
    for key, value in substitutions.items():
        out = out.replace(key, value)
    return out


def _find_by_id(items, target_id: str):
    for item in items:
        if item.id == target_id:
            return item
    return None


def _find_by_label(items, target_label: str):
    for item in items:
        if getattr(item, "label", None) == target_label:
            return item
    return None


def _render_levels_menu(pack: LanguagePack) -> str:
    return "\n".join(f"- {lvl.id}: {lvl.guidance}" for lvl in pack.levels)


def _render_goals_menu(pack: LanguagePack) -> str:
    return "\n".join(f'- "{goal.label}": {goal.guidance}' for goal in pack.goals)
