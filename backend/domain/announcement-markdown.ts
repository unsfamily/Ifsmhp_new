import MarkdownIt from 'markdown-it';

const markdown = new MarkdownIt({ html: false, linkify: false, breaks: true }).disable('image');
markdown.validateLink = value => {
  try { const url = new URL(value); return ['https:', 'http:', 'mailto:'].includes(url.protocol) && !url.username && !url.password; }
  catch { return false; }
};
markdown.renderer.rules.link_open = (tokens, index, options, _env, renderer) => {
  tokens[index]!.attrSet('rel', 'noopener noreferrer');
  tokens[index]!.attrSet('target', '_blank');
  return renderer.renderToken(tokens, index, options);
};
export const renderAnnouncement = (body: string) => markdown.render(body);
