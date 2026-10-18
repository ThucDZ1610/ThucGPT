const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const JavaScriptObfuscator = require('javascript-obfuscator');
const { minify } = require('html-minifier-terser');
const CleanCSS = require('clean-css');

const sourceDir = path.resolve(__dirname, '../frontend');
const outputDir = path.resolve(__dirname, '../frontend-dist');

const obfuscationOptions = {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.35,
  deadCodeInjection: false,
  identifierNamesGenerator: 'hexadecimal',
  renameGlobals: false,
  selfDefending: true,
  stringArray: true,
  stringArrayEncoding: ['base64'],
  stringArrayThreshold: 0.75,
};

function obfuscate(source) {
  return JavaScriptObfuscator.obfuscate(source, obfuscationOptions).getObfuscatedCode();
}

function encodeAttribute(value, quote) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(quote === '"' ? /"/g : /'/g, quote === '"' ? '&quot;' : '&#39;');
}

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}

function addSubresourceIntegrity(htmlPath) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const updated = html.replace(/<(script|link)\b([^>]*)>/gi, (tag, name, attributes) => {
    const isScript = name.toLowerCase() === 'script';
    const isStylesheet = /\brel=["']stylesheet["']/i.test(attributes);
    if (isScript && !/\bsrc=/i.test(attributes)) return tag;
    if (!isScript && !isStylesheet) return tag;

    const sourceAttribute = isScript ? 'src' : 'href';
    const match = attributes.match(new RegExp(`\\b${sourceAttribute}=["']([^"']+)["']`, 'i'));
    if (!match || !match[1].startsWith('/') || match[1].startsWith('//')) return tag;

    const localPath = decodeURIComponent(match[1].split(/[?#]/, 1)[0]);
    const assetPath = path.resolve(outputDir, `.${localPath}`);
    const relativePath = path.relative(outputDir, assetPath);
    if (relativePath.startsWith('..') || path.isAbsolute(relativePath) || !fs.existsSync(assetPath)) return tag;

    const integrity = `sha384-${crypto.createHash('sha384').update(fs.readFileSync(assetPath)).digest('base64')}`;
    const nextAttributes = /\bintegrity=["'][^"']*["']/i.test(attributes)
      ? attributes.replace(/\bintegrity=["'][^"']*["']/i, `integrity="${integrity}"`)
      : `${attributes} integrity="${integrity}"`;
    return `<${name}${nextAttributes}>`;
  });
  fs.writeFileSync(htmlPath, updated);
}

async function build() {
  fs.rmSync(outputDir, { recursive: true, force: true });
  fs.mkdirSync(outputDir, { recursive: true });

  for (const sourcePath of walk(sourceDir)) {
    const relativePath = path.relative(sourceDir, sourcePath);
    if (relativePath === 'livereload.js') continue;

    const outputPath = path.join(outputDir, relativePath);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    const source = fs.readFileSync(sourcePath);
    const extension = path.extname(sourcePath).toLowerCase();

    if (extension === '.js') {
      fs.writeFileSync(outputPath, obfuscate(source.toString('utf8')));
    } else if (extension === '.css') {
      const result = new CleanCSS({ level: 2 }).minify(source.toString('utf8'));
      if (result.errors.length) throw new Error(result.errors.join('\n'));
      fs.writeFileSync(outputPath, result.styles);
    } else if (extension === '.html') {
      let html = source.toString('utf8')
        .replace(/<script\b[^>]*\bsrc=["']\/livereload\.js[^>]*>\s*<\/script>/gi, '')
        .replace(/(<script\b([^>]*)>)([\s\S]*?)(<\/script>)/gi, (match, open, attributes, code, close) => {
          if (/\bsrc\s*=/.test(attributes) || !code.trim()) return match;
          if (/\btype=["']application\/(?:ld\+json|json)["']/i.test(attributes)) return match;
          return `${open}${obfuscate(code)}${close}`;
        })
        .replace(/\s(on[a-z]+)\s*=\s*(["'])([\s\S]*?)\2/gi, (match, name, quote, code) => {
          return ` ${name}=${quote}${encodeAttribute(obfuscate(code), quote)}${quote}`;
        });
      html = await minify(html, {
        collapseWhitespace: true,
        minifyCSS: true,
        minifyJS: false,
        removeComments: true,
        removeRedundantAttributes: true,
      });
      fs.writeFileSync(outputPath, html);
    } else {
      fs.copyFileSync(sourcePath, outputPath);
    }
  }

  for (const htmlPath of walk(outputDir).filter((filePath) => path.extname(filePath).toLowerCase() === '.html')) {
    addSubresourceIntegrity(htmlPath);
  }

  console.log(`Frontend production build created: ${outputDir}`);
}

build().catch((error) => {
  console.error('Frontend build failed:', error.message);
  process.exitCode = 1;
});