import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const root = process.cwd()
const srcDir = path.join(root, 'src')
const uiDir = path.join(srcDir, 'components', 'ui')
const extensions = new Set(['.tsx', '.jsx'])
const violations = []
const shadcnDomForwardingComponents = new Set([
  'Badge',
  'Button',
  'Card',
  'CardContent',
  'CardDescription',
  'CardHeader',
  'CardTitle',
  'DialogContent',
  'DialogTrigger',
  'DropdownMenuTrigger',
  'Input',
  'Label',
  'PopoverTrigger',
  'Progress',
  'SelectTrigger',
  'Switch',
  'Table',
  'TableCell',
  'TableHead',
  'TableRow',
  'TabsTrigger',
  'Textarea',
  'TooltipTrigger',
])

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(fullPath)
      continue
    }
    if (extensions.has(path.extname(entry.name))) {
      checkFile(fullPath)
    }
  }
}

function isInsideUi(filePath) {
  return filePath === uiDir || filePath.startsWith(`${uiDir}${path.sep}`)
}

function jsxNameToString(name) {
  if (ts.isIdentifier(name)) return name.text
  return ''
}

function attrName(attr) {
  return ts.isJsxAttribute(attr) && ts.isIdentifier(attr.name) ? attr.name.text : ''
}

function staticAttrValue(attr) {
  if (!ts.isJsxAttribute(attr) || !attr.initializer) return ''
  if (ts.isStringLiteral(attr.initializer)) return attr.initializer.text
  if (ts.isJsxExpression(attr.initializer)) {
    const expression = attr.initializer.expression
    if (expression && ts.isStringLiteralLike(expression)) return expression.text
  }
  return ''
}

function hasBooleanAttr(attrs, name) {
  return attrs.some((attr) => ts.isJsxAttribute(attr) && attrName(attr) === name && !attr.initializer)
}

function hasStaticClass(attrs, className) {
  const attr = attrs.find((candidate) => attrName(candidate) === 'className')
  return attr ? staticAttrValue(attr).split(/\s+/).includes(className) : false
}

function inputAllowed(attrs) {
  const typeAttr = attrs.find((candidate) => attrName(candidate) === 'type')
  const inputType = staticAttrValue(typeAttr).toLowerCase()
  if (inputType === 'hidden') return true
  if (inputType === 'file' && (hasStaticClass(attrs, 'hidden') || hasBooleanAttr(attrs, 'hidden'))) return true
  return false
}

function addViolation(sourceFile, node, message) {
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
  violations.push({
    file: path.relative(root, sourceFile.fileName),
    line: line + 1,
    column: character + 1,
    message,
  })
}

function checkFile(filePath) {
  if (isInsideUi(filePath)) return
  const sourceText = fs.readFileSync(filePath, 'utf8')
  const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)

  function visit(node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = jsxNameToString(node.tagName)
      const attrs = node.attributes.properties
      if (
        attrs.some((attr) => attrName(attr) === 'title') &&
        (tag === tag.toLowerCase() || shadcnDomForwardingComponents.has(tag))
      ) {
        addViolation(sourceFile, node, 'Use shadcn Tooltip components instead of title attributes.')
      }
      if (tag && tag === tag.toLowerCase()) {
        if (tag === 'button') addViolation(sourceFile, node, 'Use shadcn <Button> instead of visible <button>.')
        if (tag === 'select') addViolation(sourceFile, node, 'Use shadcn Select components instead of <select>.')
        if (tag === 'textarea') addViolation(sourceFile, node, 'Use shadcn <Textarea> instead of <textarea>.')
        if (tag === 'input' && !inputAllowed(attrs)) addViolation(sourceFile, node, 'Use shadcn <Input> for visible inputs. Hidden file/hidden inputs are allowed.')
      }
    }
    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
}

walk(srcDir)

if (violations.length > 0) {
  console.error('shadcn/ui usage check failed:')
  for (const violation of violations) {
    console.error(`${violation.file}:${violation.line}:${violation.column} ${violation.message}`)
  }
  process.exit(1)
}

console.log('shadcn/ui usage check passed')
