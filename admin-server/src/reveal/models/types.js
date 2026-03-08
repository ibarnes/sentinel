/**
 * Canonical Reveal data model interfaces (JSDoc runtime-neutral).
 */

/** @typedef {{x:number,y:number,width:number,height:number}|null} ElementBox */

/**
 * @typedef {Object} TargetDescriptor
 * @property {string|null} selector
 * @property {string|null} domPath
 * @property {string|null} text
 * @property {string|null} role
 * @property {string|null} elementType
 * @property {string|null} tagName
 * @property {Record<string, string|null>|undefined} attributes
 * @property {ElementBox} elementBox
 */

/**
 * @typedef {Object} PageDescriptor
 * @property {string} url
 * @property {string|null} title
 * @property {string|null} routeKey
 */

/**
 * @typedef {Object} ScreenshotSet
 * @property {string|null} beforeUrl
 * @property {string|null} afterUrl
 * @property {string|null} highlightedUrl
 * @property {Object|undefined} provenance
 */

/**
 * @typedef {Object} Annotation
 * @property {string} id
 * @property {string} author
 * @property {string} text
 * @property {string} createdAt
 */

/**
 * @typedef {Object} RawEvent
 * @property {string} id
 * @property {string} sessionId
 * @property {string} ts
 * @property {string} type
 * @property {string} url
 * @property {string|null} selector
 * @property {string|null} domPath
 * @property {string|null} text
 * @property {string|null} valueMasked
 * @property {Object|null} fileMeta
 * @property {{width:number,height:number}|null} viewport
 * @property {string|null} screenshotUrl
 * @property {ElementBox} elementBox
 * @property {string|null} framePath
 * @property {Record<string, any>} metadata
 */

/**
 * @typedef {Object} Step
 * @property {string} id
 * @property {number} index
 * @property {string} title
 * @property {string} action
 * @property {string|null} intent
 * @property {TargetDescriptor} target
 * @property {PageDescriptor} page
 * @property {ScreenshotSet} screenshots
 * @property {string[]} events
 * @property {number} confidence
 * @property {Record<string, any>} metadata
 * @property {Annotation[]} annotations
 */

/**
 * @typedef {Object} Flow
 * @property {string} id
 * @property {string} sessionId
 * @property {string} name
 * @property {string|null} description
 * @property {string} appHost
 * @property {string} startedAt
 * @property {string|null} endedAt
 * @property {string} createdBy
 * @property {'draft'|'reviewed'} status
 * @property {Step[]} steps
 * @property {number} rawEventCount
 * @property {number} version
 */

export const RevealTypes = Object.freeze({
  Flow: 'Flow',
  Step: 'Step',
  RawEvent: 'RawEvent',
  Annotation: 'Annotation',
  ScreenshotSet: 'ScreenshotSet',
  TargetDescriptor: 'TargetDescriptor',
  PageDescriptor: 'PageDescriptor'
});
