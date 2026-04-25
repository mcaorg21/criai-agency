import { readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';
dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));

const rawSkillsPath = process.env.SKILLS_PATH || '../../../claude-skills-paid-media/claude-skills-paid-media';
const SKILLS_PATH = rawSkillsPath.startsWith('C:') || rawSkillsPath.startsWith('/')
  ? rawSkillsPath
  : resolve(__dirname, rawSkillsPath);

const SKILL_NAMES = [
  'brand-reader',
  'display-copy-builder',
  'display-creative-formatter',
  'display-banner-renderer',
  'multi-channel-adapter',
  'ad-short-copy-generator',
  'email-marketing-html-builder',
  'creative-performance-evaluator',
  'audience-reaction-simulator',
  'image-prompt-builder',
];

export function loadSkill(name) {
  const path = join(SKILLS_PATH, name, 'SKILL.md');
  if (!existsSync(path)) throw new Error(`Skill não encontrada: ${path}`);
  return readFileSync(path, 'utf8');
}

export function loadAllSkills() {
  return Object.fromEntries(
    SKILL_NAMES.map((name) => [name, loadSkill(name)])
  );
}
