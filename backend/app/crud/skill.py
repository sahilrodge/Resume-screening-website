"""Skill get-or-create helpers."""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.enums import SkillLevel
from app.models.skill import CandidateSkill, Skill


class CRUDSkill:
    def get_or_create(self, db: Session, *, name: str) -> Skill:
        cleaned = name.strip()
        if not cleaned:
            raise ValueError("Skill name cannot be empty")

        existing = db.scalar(
            select(Skill).where(func.lower(Skill.name) == cleaned.lower())
        )
        if existing:
            return existing

        skill = Skill(name=cleaned)
        db.add(skill)
        db.flush()
        return skill

    def sync_candidate_skills(
        self,
        db: Session,
        *,
        candidate_id,
        skill_names: list[str],
    ) -> None:
        """Replace candidate skills with the given names (deduped)."""
        seen: set[str] = set()
        unique: list[str] = []
        for raw in skill_names:
            key = raw.strip().lower()
            if not key or key in seen:
                continue
            seen.add(key)
            unique.append(raw.strip())

        # Clear existing links
        existing = list(
            db.scalars(
                select(CandidateSkill).where(CandidateSkill.candidate_id == candidate_id)
            ).all()
        )
        for link in existing:
            db.delete(link)
        db.flush()

        for name in unique[:50]:
            skill = self.get_or_create(db, name=name)
            db.add(
                CandidateSkill(
                    candidate_id=candidate_id,
                    skill_id=skill.id,
                    level=SkillLevel.INTERMEDIATE,
                )
            )


skill = CRUDSkill()
