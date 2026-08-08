/**
 * Every user-visible mention of the product name flows through this module.
 *
 * Renaming the project should mean editing this file and the `name` field in
 * package.json — nothing else. Avoid hard-coding the product name anywhere in
 * `app/` or `components/`.
 */

export const branding = {
  /** Short product name, used in titles, headings and the sidebar. */
  name: 'Commonleaf',

  /** One line, shown under the name on the home page and in metadata. */
  tagline: 'A self-hostable commonplace book powered by Markdown and Git.',

  /**
   * A sentence for `<meta name="description">` and the README. Keep it
   * descriptive rather than promotional.
   */
  description:
    'A quiet place to keep ideas, quotes, reading notes and journal entries as plain Markdown files in a Git repository.',

  /** Shown in the footer and the settings page. */
  repositoryUrl: 'https://github.com/SAKMZ/commonleaf',

  /** Used for the default commit author when the token has no public email. */
  commitAuthor: {
    name: 'Commonleaf',
    email: 'commonleaf@users.noreply.github.com',
  },
} as const;

export type Branding = typeof branding;
