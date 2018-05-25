const css = require('css')
const { getCSS, getHashes } = require('./utils')

const KEY = '__jest-styled-components__'

const getNodes = (node, nodes = []) => {
  if (typeof node === 'object') {
    nodes.push(node)
  }

  if (node.children) {
    node.children.forEach(child => getNodes(child, nodes))
  }

  return nodes
}

const markNodes = nodes => nodes.forEach(node => (node[KEY] = true))

const getClassNames = nodes =>
  nodes.reduce((classNames, node) => {
    const classNameProp =
      node.props && (node.props.class || node.props.className)

    if (classNameProp) {
      classNameProp
        .trim()
        .split(/\s+/)
        .forEach(className => classNames.add(className))
    }

    return classNames
  }, new Set())

const filterClassNames = (classNames, hashes) =>
  classNames.filter(className => hashes.includes(className))

const includesClassNames = (classNames, selectors) =>
  classNames.some(className =>
    selectors.some(selector => selector.includes(className))
  )

const filterRules = classNames => rule =>
  rule.type === 'rule' &&
  includesClassNames(classNames, rule.selectors) &&
  rule.declarations.length

const getAtRules = (ast, filter) =>
  ast.stylesheet.rules
    .filter(rule => rule.type === 'media' || rule.type === 'supports')
    .reduce((acc, atRule) => {
      atRule.rules = atRule.rules.filter(filter)

      if (atRule.rules.length) {
        return acc.concat(atRule)
      }

      return acc
    }, [])

const getStyle = classNames => {
  const ast = getCSS()
  const filter = filterRules(classNames)
  const rules = ast.stylesheet.rules.filter(filter)
  const atRules = getAtRules(ast, filter)

  ast.stylesheet.rules = rules.concat(atRules)
  return css.stringify(ast)
}

const generateClassName = (className, classNameMap) => {
  let name
  const isClassNameExtended = className.split('-')
  if (isClassNameExtended.length > 1) {
    name = isClassNameExtended[0]
  } else {
    Object.entries(classNameMap).forEach(([desiredClassName, subMap]) => {
      Object.entries(subMap).forEach(([classSuffix, classNameArr], index) => {
        const classIndex = classNameArr.indexOf(className)
        if (index > 0) {
          if (classIndex === 0) {
            name = `${desiredClassName}_ext${index}`
          } else if (classIndex > 0) {
            name = `${desiredClassName}_ext${index}-${classIndex}`
          }
        } else if (classIndex === 0) {
          name = `${desiredClassName}`
        } else if (classIndex > 0) {
          name = `${desiredClassName}-${classIndex}`
        }
      })
    })
  }
  return name
}

const replaceClassNames = (result, classNames, style) => {
  const names = classNames.join(' ')
  const splitNames = names.split(/([^_\s]+__[a-zA-Z0-9]+-[a-zA-Z0-9]+)/)
  const classNameMap = {}
  let placeholderClassName
  let placeholderClassNameSuffix
  splitNames.forEach(name => {
    if (name === '') {
    } else if (name[0] === ' ') {
      const classArr = name.split(' ').filter(className => className)
      classNameMap[placeholderClassName][
        placeholderClassNameSuffix
      ] = classNameMap[placeholderClassName][placeholderClassNameSuffix]
        ? classNameMap[placeholderClassName][placeholderClassNameSuffix].concat(
            classArr
          )
        : classArr
    } else {
      [placeholderClassName, placeholderClassNameSuffix] = name.split('-')
      classNameMap[placeholderClassName] = classNameMap[placeholderClassName]
        ? classNameMap[placeholderClassName]
        : {}
      classNameMap[placeholderClassName][placeholderClassNameSuffix] = []
    }
  })

  return classNames
    .filter(className => style.includes(className))
    .reduce(
      (acc, className) =>
        acc.replace(
          new RegExp(className, 'g'),
          generateClassName(className, classNameMap)
        ),
      result
    )
}

const replaceHashes = (result, hashes) =>
  hashes.reduce(
    (acc, className) =>
      acc.replace(
        new RegExp(`((class|className)="[^"]*?)${className}\\s?([^"]*")`, 'g'),
        '$1$3'
      ),
    result
  )

const styleSheetSerializer = {
  test(val) {
    return val && !val[KEY] && val.$$typeof === Symbol.for('react.test.json')
  },

  print(val, print) {
    const nodes = getNodes(val)
    markNodes(nodes)

    const hashes = getHashes()
    let classNames = [...getClassNames(nodes)]
    classNames = filterClassNames(classNames, hashes)

    const style = getStyle(classNames)
    const code = print(val)

    let result = `${style}${style ? '\n\n' : ''}${code}`
    result = replaceClassNames(result, classNames, style)
    result = replaceHashes(result, hashes)

    return result
  },
}

module.exports = styleSheetSerializer
