/**
 * @template {HTMLElement} TType
 * @param {string} elementId
 * @param {{ new(): TType; name: string; }} [type]
 * @returns {TType}
 */
function getKnownElementById(elementId, type) {
	const element = document.getElementById(elementId);
	if (!element) {
		throw new ReferenceError(`Element with id "${elementId}" was expected in document, but was missing.`)
	}

	if (type && !(element instanceof type)) {
		throw new TypeError(`Element with id "${elementId}" was expected to be of type ${type.name} but was actually of type ${element.constructor?.name}`);
	}

	// @ts-ignore
	return element;
}

/**
 * @template {HTMLElement} TType
 * @param {HTMLElement | ParentNode} parent
 * @param {string} selector
 * @param {{ new(): TType; name: string; }} [type]
 * @returns {TType}
 */
function queryKnownSelector(parent, selector, type) {
  const element = parent.querySelector(selector);

  if (!element) {
    let parentName;
    if (parent === document) {
      parentName = "document";
    }
    else if ('classList' in parent) {
      if (parent.id) {
        parentName = parent.id;
      }
      else {
        parentName = parent.tagName;
        if (parent.classList.length) {
          parentName = `${parentName} ${parent.classList}`;
        }
      }
    }
    throw new ReferenceError(`Element with selector "${selector}" was expected under ${parentName}, but was missing.`)
  }

  if (type && !(element instanceof type)) {
    throw new TypeError(`Element with selector "${selector}" was expected to be of type ${type.name} but was actually of type ${element.constructor?.name}`);
  }

  // @ts-ignore
  return element;
}

/**
 * @template {Node} TType
 * @param {{ new(): TType; name: string; }} type
 * @param {Node} node
 * @returns {TType}
 */
function castNode(type, node) {
  if (type && !(node instanceof type)) {
    throw new TypeError(`Node "${node}" was expected to be of type ${type.name} but was actually of type ${node.constructor?.name}`);
  }

  // @ts-ignore
  return node;
}

export {
  getKnownElementById,
  queryKnownSelector,
  castNode
};
