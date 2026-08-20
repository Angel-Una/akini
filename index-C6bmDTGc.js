var __create = Object.create;
var __defProp$16 = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJSMin = (cb$1, mod) => () => (mod || cb$1((mod = { exports: {} }).exports, mod), mod.exports);
var __copyProps = (to, from, except, desc) => {
	if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n$2 = keys.length, key; i < n$2; i++) {
		key = keys[i];
		if (!__hasOwnProp.call(to, key) && key !== except) __defProp$16(to, key, {
			get: ((k$2) => from[k$2]).bind(null, key),
			enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
		});
	}
	return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule ? __defProp$16(target, "default", {
	value: mod,
	enumerable: true
}) : target, mod));
(function polyfill() {
	const relList = document.createElement("link").relList;
	if (relList && relList.supports && relList.supports("modulepreload")) return;
	for (const link of document.querySelectorAll("link[rel=\"modulepreload\"]")) processPreload(link);
	new MutationObserver((mutations) => {
		for (const mutation of mutations) {
			if (mutation.type !== "childList") continue;
			for (const node of mutation.addedNodes) if (node.tagName === "LINK" && node.rel === "modulepreload") processPreload(node);
		}
	}).observe(document, {
		childList: true,
		subtree: true
	});
	function getFetchOpts(link) {
		const fetchOpts = {};
		if (link.integrity) fetchOpts.integrity = link.integrity;
		if (link.referrerPolicy) fetchOpts.referrerPolicy = link.referrerPolicy;
		if (link.crossOrigin === "use-credentials") fetchOpts.credentials = "include";
		else if (link.crossOrigin === "anonymous") fetchOpts.credentials = "omit";
		else fetchOpts.credentials = "same-origin";
		return fetchOpts;
	}
	function processPreload(link) {
		if (link.ep) return;
		link.ep = true;
		const fetchOpts = getFetchOpts(link);
		fetch(link.href, fetchOpts);
	}
})();
var DEBUG_BUILD$3 = typeof __SENTRY_DEBUG__ === "undefined" || __SENTRY_DEBUG__;
var GLOBAL_OBJ = globalThis;
var SDK_VERSION = "9.47.1";
function getMainCarrier() {
	getSentryCarrier(GLOBAL_OBJ);
	return GLOBAL_OBJ;
}
function getSentryCarrier(carrier) {
	const __SENTRY__ = carrier.__SENTRY__ = carrier.__SENTRY__ || {};
	__SENTRY__.version = __SENTRY__.version || "9.47.1";
	return __SENTRY__[SDK_VERSION] = __SENTRY__["9.47.1"] || {};
}
function getGlobalSingleton(name, creator, obj = GLOBAL_OBJ) {
	const __SENTRY__ = obj.__SENTRY__ = obj.__SENTRY__ || {};
	const carrier = __SENTRY__[SDK_VERSION] = __SENTRY__["9.47.1"] || {};
	return carrier[name] || (carrier[name] = creator());
}
var CONSOLE_LEVELS = [
	"debug",
	"info",
	"warn",
	"error",
	"log",
	"assert",
	"trace"
];
var PREFIX = "Sentry Logger ";
var originalConsoleMethods = {};
function consoleSandbox(callback) {
	if (!("console" in GLOBAL_OBJ)) return callback();
	const console$1 = GLOBAL_OBJ.console;
	const wrappedFuncs = {};
	const wrappedLevels = Object.keys(originalConsoleMethods);
	wrappedLevels.forEach((level) => {
		const originalConsoleMethod = originalConsoleMethods[level];
		wrappedFuncs[level] = console$1[level];
		console$1[level] = originalConsoleMethod;
	});
	try {
		return callback();
	} finally {
		wrappedLevels.forEach((level) => {
			console$1[level] = wrappedFuncs[level];
		});
	}
}
function enable() {
	_getLoggerSettings().enabled = true;
}
function disable() {
	_getLoggerSettings().enabled = false;
}
function isEnabled() {
	return _getLoggerSettings().enabled;
}
function log(...args) {
	_maybeLog("log", ...args);
}
function warn(...args) {
	_maybeLog("warn", ...args);
}
function error(...args) {
	_maybeLog("error", ...args);
}
function _maybeLog(level, ...args) {
	if (!DEBUG_BUILD$3) return;
	if (isEnabled()) consoleSandbox(() => {
		GLOBAL_OBJ.console[level](`${PREFIX}[${level}]:`, ...args);
	});
}
function _getLoggerSettings() {
	if (!DEBUG_BUILD$3) return { enabled: false };
	return getGlobalSingleton("loggerSettings", () => ({ enabled: false }));
}
var debug = {
	enable,
	disable,
	isEnabled,
	log,
	warn,
	error
};
var STACKTRACE_FRAME_LIMIT = 50;
var WEBPACK_ERROR_REGEXP = /\(error: (.*)\)/;
var STRIP_FRAME_REGEXP = /captureMessage|captureException/;
function createStackParser(...parsers) {
	const sortedParsers = parsers.sort((a, b$1) => a[0] - b$1[0]).map((p$4) => p$4[1]);
	return (stack, skipFirstLines = 0, framesToPop = 0) => {
		const frames = [];
		const lines = stack.split("\n");
		for (let i = skipFirstLines; i < lines.length; i++) {
			const line = lines[i];
			if (line.length > 1024) continue;
			const cleanedLine = WEBPACK_ERROR_REGEXP.test(line) ? line.replace(WEBPACK_ERROR_REGEXP, "$1") : line;
			if (cleanedLine.match(/\S*Error: /)) continue;
			for (const parser of sortedParsers) {
				const frame = parser(cleanedLine);
				if (frame) {
					frames.push(frame);
					break;
				}
			}
			if (frames.length >= STACKTRACE_FRAME_LIMIT + framesToPop) break;
		}
		return stripSentryFramesAndReverse(frames.slice(framesToPop));
	};
}
function stackParserFromStackParserOptions(stackParser) {
	if (Array.isArray(stackParser)) return createStackParser(...stackParser);
	return stackParser;
}
function stripSentryFramesAndReverse(stack) {
	if (!stack.length) return [];
	const localStack = Array.from(stack);
	if (/sentryWrapped/.test(getLastStackFrame(localStack).function || "")) localStack.pop();
	localStack.reverse();
	if (STRIP_FRAME_REGEXP.test(getLastStackFrame(localStack).function || "")) {
		localStack.pop();
		if (STRIP_FRAME_REGEXP.test(getLastStackFrame(localStack).function || "")) localStack.pop();
	}
	return localStack.slice(0, STACKTRACE_FRAME_LIMIT).map((frame) => ({
		...frame,
		filename: frame.filename || getLastStackFrame(localStack).filename,
		function: frame.function || "?"
	}));
}
function getLastStackFrame(arr) {
	return arr[arr.length - 1] || {};
}
var defaultFunctionName = "<anonymous>";
function getFunctionName(fn) {
	try {
		if (!fn || typeof fn !== "function") return defaultFunctionName;
		return fn.name || defaultFunctionName;
	} catch {
		return defaultFunctionName;
	}
}
function getFramesFromEvent(event) {
	const exception = event.exception;
	if (exception) {
		const frames = [];
		try {
			exception.values.forEach((value) => {
				if (value.stacktrace.frames) frames.push(...value.stacktrace.frames);
			});
			return frames;
		} catch {
			return;
		}
	}
}
var handlers = {};
var instrumented = {};
function addHandler(type, handler) {
	handlers[type] = handlers[type] || [];
	handlers[type].push(handler);
}
function maybeInstrument(type, instrumentFn) {
	if (!instrumented[type]) {
		instrumented[type] = true;
		try {
			instrumentFn();
		} catch (e) {
			DEBUG_BUILD$3 && debug.error(`Error while instrumenting ${type}`, e);
		}
	}
}
function triggerHandlers(type, data) {
	const typeHandlers = type && handlers[type];
	if (!typeHandlers) return;
	for (const handler of typeHandlers) try {
		handler(data);
	} catch (e) {
		DEBUG_BUILD$3 && debug.error(`Error while triggering instrumentation handler.\nType: ${type}\nName: ${getFunctionName(handler)}\nError:`, e);
	}
}
var _oldOnErrorHandler = null;
function addGlobalErrorInstrumentationHandler(handler) {
	const type = "error";
	addHandler(type, handler);
	maybeInstrument(type, instrumentError);
}
function instrumentError() {
	_oldOnErrorHandler = GLOBAL_OBJ.onerror;
	GLOBAL_OBJ.onerror = function(msg, url, line, column, error$1) {
		triggerHandlers("error", {
			column,
			error: error$1,
			line,
			msg,
			url
		});
		if (_oldOnErrorHandler) return _oldOnErrorHandler.apply(this, arguments);
		return false;
	};
	GLOBAL_OBJ.onerror.__SENTRY_INSTRUMENTED__ = true;
}
var _oldOnUnhandledRejectionHandler = null;
function addGlobalUnhandledRejectionInstrumentationHandler(handler) {
	const type = "unhandledrejection";
	addHandler(type, handler);
	maybeInstrument(type, instrumentUnhandledRejection);
}
function instrumentUnhandledRejection() {
	_oldOnUnhandledRejectionHandler = GLOBAL_OBJ.onunhandledrejection;
	GLOBAL_OBJ.onunhandledrejection = function(e) {
		triggerHandlers("unhandledrejection", e);
		if (_oldOnUnhandledRejectionHandler) return _oldOnUnhandledRejectionHandler.apply(this, arguments);
		return true;
	};
	GLOBAL_OBJ.onunhandledrejection.__SENTRY_INSTRUMENTED__ = true;
}
var objectToString = Object.prototype.toString;
function isError(wat) {
	switch (objectToString.call(wat)) {
		case "[object Error]":
		case "[object Exception]":
		case "[object DOMException]":
		case "[object WebAssembly.Exception]": return true;
		default: return isInstanceOf(wat, Error);
	}
}
function isBuiltin(wat, className) {
	return objectToString.call(wat) === `[object ${className}]`;
}
function isErrorEvent(wat) {
	return isBuiltin(wat, "ErrorEvent");
}
function isDOMError(wat) {
	return isBuiltin(wat, "DOMError");
}
function isDOMException(wat) {
	return isBuiltin(wat, "DOMException");
}
function isString(wat) {
	return isBuiltin(wat, "String");
}
function isParameterizedString(wat) {
	return typeof wat === "object" && wat !== null && "__sentry_template_string__" in wat && "__sentry_template_values__" in wat;
}
function isPrimitive(wat) {
	return wat === null || isParameterizedString(wat) || typeof wat !== "object" && typeof wat !== "function";
}
function isPlainObject(wat) {
	return isBuiltin(wat, "Object");
}
function isEvent(wat) {
	return typeof Event !== "undefined" && isInstanceOf(wat, Event);
}
function isElement$1(wat) {
	return typeof Element !== "undefined" && isInstanceOf(wat, Element);
}
function isRegExp(wat) {
	return isBuiltin(wat, "RegExp");
}
function isThenable(wat) {
	return Boolean(wat?.then && typeof wat.then === "function");
}
function isSyntheticEvent(wat) {
	return isPlainObject(wat) && "nativeEvent" in wat && "preventDefault" in wat && "stopPropagation" in wat;
}
function isInstanceOf(wat, base) {
	try {
		return wat instanceof base;
	} catch {
		return false;
	}
}
function isVueViewModel(wat) {
	return !!(typeof wat === "object" && wat !== null && (wat.__isVue || wat._isVue));
}
function isRequest(request) {
	return typeof Request !== "undefined" && isInstanceOf(request, Request);
}
var WINDOW$3 = GLOBAL_OBJ;
var DEFAULT_MAX_STRING_LENGTH = 80;
function htmlTreeAsString(elem, options = {}) {
	if (!elem) return "<unknown>";
	try {
		let currentElem = elem;
		const MAX_TRAVERSE_HEIGHT = 5;
		const out = [];
		let height = 0;
		let len = 0;
		const separator = " > ";
		const sepLength = 3;
		let nextStr;
		const keyAttrs = Array.isArray(options) ? options : options.keyAttrs;
		const maxStringLength = !Array.isArray(options) && options.maxStringLength || DEFAULT_MAX_STRING_LENGTH;
		while (currentElem && height++ < MAX_TRAVERSE_HEIGHT) {
			nextStr = _htmlElementAsString(currentElem, keyAttrs);
			if (nextStr === "html" || height > 1 && len + out.length * sepLength + nextStr.length >= maxStringLength) break;
			out.push(nextStr);
			len += nextStr.length;
			currentElem = currentElem.parentNode;
		}
		return out.reverse().join(separator);
	} catch {
		return "<unknown>";
	}
}
function _htmlElementAsString(el$1, keyAttrs) {
	const elem = el$1;
	const out = [];
	if (!elem?.tagName) return "";
	if (WINDOW$3.HTMLElement) {
		if (elem instanceof HTMLElement && elem.dataset) {
			if (elem.dataset["sentryComponent"]) return elem.dataset["sentryComponent"];
			if (elem.dataset["sentryElement"]) return elem.dataset["sentryElement"];
		}
	}
	out.push(elem.tagName.toLowerCase());
	const keyAttrPairs = keyAttrs?.length ? keyAttrs.filter((keyAttr) => elem.getAttribute(keyAttr)).map((keyAttr) => [keyAttr, elem.getAttribute(keyAttr)]) : null;
	if (keyAttrPairs?.length) keyAttrPairs.forEach((keyAttrPair) => {
		out.push(`[${keyAttrPair[0]}="${keyAttrPair[1]}"]`);
	});
	else {
		if (elem.id) out.push(`#${elem.id}`);
		const className = elem.className;
		if (className && isString(className)) {
			const classes = className.split(/\s+/);
			for (const c of classes) out.push(`.${c}`);
		}
	}
	for (const k$2 of [
		"aria-label",
		"type",
		"name",
		"title",
		"alt"
	]) {
		const attr = elem.getAttribute(k$2);
		if (attr) out.push(`[${k$2}="${attr}"]`);
	}
	return out.join("");
}
function getLocationHref() {
	try {
		return WINDOW$3.document.location.href;
	} catch {
		return "";
	}
}
function getComponentName(elem) {
	if (!WINDOW$3.HTMLElement) return null;
	let currentElem = elem;
	const MAX_TRAVERSE_HEIGHT = 5;
	for (let i = 0; i < MAX_TRAVERSE_HEIGHT; i++) {
		if (!currentElem) return null;
		if (currentElem instanceof HTMLElement) {
			if (currentElem.dataset["sentryComponent"]) return currentElem.dataset["sentryComponent"];
			if (currentElem.dataset["sentryElement"]) return currentElem.dataset["sentryElement"];
		}
		currentElem = currentElem.parentNode;
	}
	return null;
}
function truncate(str, max$1 = 0) {
	if (typeof str !== "string" || max$1 === 0) return str;
	return str.length <= max$1 ? str : `${str.slice(0, max$1)}...`;
}
function safeJoin(input, delimiter) {
	if (!Array.isArray(input)) return "";
	const output = [];
	for (let i = 0; i < input.length; i++) {
		const value = input[i];
		try {
			if (isVueViewModel(value)) output.push("[VueViewModel]");
			else output.push(String(value));
		} catch {
			output.push("[value cannot be serialized]");
		}
	}
	return output.join(delimiter);
}
function isMatchingPattern(value, pattern, requireExactStringMatch = false) {
	if (!isString(value)) return false;
	if (isRegExp(pattern)) return pattern.test(value);
	if (isString(pattern)) return requireExactStringMatch ? value === pattern : value.includes(pattern);
	return false;
}
function stringMatchesSomePattern(testString, patterns = [], requireExactStringMatch = false) {
	return patterns.some((pattern) => isMatchingPattern(testString, pattern, requireExactStringMatch));
}
function fill(source, name, replacementFactory) {
	if (!(name in source)) return;
	const original = source[name];
	if (typeof original !== "function") return;
	const wrapped = replacementFactory(original);
	if (typeof wrapped === "function") markFunctionWrapped(wrapped, original);
	try {
		source[name] = wrapped;
	} catch {
		DEBUG_BUILD$3 && debug.log(`Failed to replace method "${name}" in object`, source);
	}
}
function addNonEnumerableProperty(obj, name, value) {
	try {
		Object.defineProperty(obj, name, {
			value,
			writable: true,
			configurable: true
		});
	} catch {
		DEBUG_BUILD$3 && debug.log(`Failed to add non-enumerable property "${name}" to object`, obj);
	}
}
function markFunctionWrapped(wrapped, original) {
	try {
		wrapped.prototype = original.prototype = original.prototype || {};
		addNonEnumerableProperty(wrapped, "__sentry_original__", original);
	} catch {}
}
function getOriginalFunction(func) {
	return func.__sentry_original__;
}
function convertToPlainObject(value) {
	if (isError(value)) return {
		message: value.message,
		name: value.name,
		stack: value.stack,
		...getOwnProperties(value)
	};
	else if (isEvent(value)) {
		const newObj = {
			type: value.type,
			target: serializeEventTarget(value.target),
			currentTarget: serializeEventTarget(value.currentTarget),
			...getOwnProperties(value)
		};
		if (typeof CustomEvent !== "undefined" && isInstanceOf(value, CustomEvent)) newObj.detail = value.detail;
		return newObj;
	} else return value;
}
function serializeEventTarget(target) {
	try {
		return isElement$1(target) ? htmlTreeAsString(target) : Object.prototype.toString.call(target);
	} catch {
		return "<unknown>";
	}
}
function getOwnProperties(obj) {
	if (typeof obj === "object" && obj !== null) {
		const extractedProps = {};
		for (const property in obj) if (Object.prototype.hasOwnProperty.call(obj, property)) extractedProps[property] = obj[property];
		return extractedProps;
	} else return {};
}
function extractExceptionKeysForMessage(exception, maxLength = 40) {
	const keys = Object.keys(convertToPlainObject(exception));
	keys.sort();
	const firstKey = keys[0];
	if (!firstKey) return "[object has no keys]";
	if (firstKey.length >= maxLength) return truncate(firstKey, maxLength);
	for (let includedKeys = keys.length; includedKeys > 0; includedKeys--) {
		const serialized = keys.slice(0, includedKeys).join(", ");
		if (serialized.length > maxLength) continue;
		if (includedKeys === keys.length) return serialized;
		return truncate(serialized, maxLength);
	}
	return "";
}
function getCrypto() {
	const gbl = GLOBAL_OBJ;
	return gbl.crypto || gbl.msCrypto;
}
function uuid4(crypto = getCrypto()) {
	let getRandomByte = () => Math.random() * 16;
	try {
		if (crypto?.randomUUID) return crypto.randomUUID().replace(/-/g, "");
		if (crypto?.getRandomValues) getRandomByte = () => {
			const typedArray = new Uint8Array(1);
			crypto.getRandomValues(typedArray);
			return typedArray[0];
		};
	} catch {}
	return "10000000100040008000100000000000".replace(/[018]/g, (c) => (c ^ (getRandomByte() & 15) >> c / 4).toString(16));
}
function getFirstException(event) {
	return event.exception?.values?.[0];
}
function getEventDescription(event) {
	const { message, event_id: eventId } = event;
	if (message) return message;
	const firstException = getFirstException(event);
	if (firstException) {
		if (firstException.type && firstException.value) return `${firstException.type}: ${firstException.value}`;
		return firstException.type || firstException.value || eventId || "<unknown>";
	}
	return eventId || "<unknown>";
}
function addExceptionTypeValue(event, value, type) {
	const exception = event.exception = event.exception || {};
	const values = exception.values = exception.values || [];
	const firstException = values[0] = values[0] || {};
	if (!firstException.value) firstException.value = value || "";
	if (!firstException.type) firstException.type = type || "Error";
}
function addExceptionMechanism(event, newMechanism) {
	const firstException = getFirstException(event);
	if (!firstException) return;
	const defaultMechanism = {
		type: "generic",
		handled: true
	};
	const currentMechanism = firstException.mechanism;
	firstException.mechanism = {
		...defaultMechanism,
		...currentMechanism,
		...newMechanism
	};
	if (newMechanism && "data" in newMechanism) {
		const mergedData = {
			...currentMechanism?.data,
			...newMechanism.data
		};
		firstException.mechanism.data = mergedData;
	}
}
function checkOrSetAlreadyCaught(exception) {
	if (isAlreadyCaptured(exception)) return true;
	try {
		addNonEnumerableProperty(exception, "__sentry_captured__", true);
	} catch {}
	return false;
}
function isAlreadyCaptured(exception) {
	try {
		return exception.__sentry_captured__;
	} catch {}
}
var ONE_SECOND_IN_MS = 1e3;
function dateTimestampInSeconds() {
	return Date.now() / ONE_SECOND_IN_MS;
}
function createUnixTimestampInSecondsFunc() {
	const { performance: performance$1 } = GLOBAL_OBJ;
	if (!performance$1?.now || !performance$1.timeOrigin) return dateTimestampInSeconds;
	const timeOrigin = performance$1.timeOrigin;
	return () => {
		return (timeOrigin + performance$1.now()) / ONE_SECOND_IN_MS;
	};
}
var _cachedTimestampInSeconds;
function timestampInSeconds() {
	return (_cachedTimestampInSeconds ?? (_cachedTimestampInSeconds = createUnixTimestampInSecondsFunc()))();
}
function makeSession(context) {
	const startingTime = timestampInSeconds();
	const session = {
		sid: uuid4(),
		init: true,
		timestamp: startingTime,
		started: startingTime,
		duration: 0,
		status: "ok",
		errors: 0,
		ignoreDuration: false,
		toJSON: () => sessionToJSON(session)
	};
	if (context) updateSession(session, context);
	return session;
}
function updateSession(session, context = {}) {
	if (context.user) {
		if (!session.ipAddress && context.user.ip_address) session.ipAddress = context.user.ip_address;
		if (!session.did && !context.did) session.did = context.user.id || context.user.email || context.user.username;
	}
	session.timestamp = context.timestamp || timestampInSeconds();
	if (context.abnormal_mechanism) session.abnormal_mechanism = context.abnormal_mechanism;
	if (context.ignoreDuration) session.ignoreDuration = context.ignoreDuration;
	if (context.sid) session.sid = context.sid.length === 32 ? context.sid : uuid4();
	if (context.init !== void 0) session.init = context.init;
	if (!session.did && context.did) session.did = `${context.did}`;
	if (typeof context.started === "number") session.started = context.started;
	if (session.ignoreDuration) session.duration = void 0;
	else if (typeof context.duration === "number") session.duration = context.duration;
	else {
		const duration = session.timestamp - session.started;
		session.duration = duration >= 0 ? duration : 0;
	}
	if (context.release) session.release = context.release;
	if (context.environment) session.environment = context.environment;
	if (!session.ipAddress && context.ipAddress) session.ipAddress = context.ipAddress;
	if (!session.userAgent && context.userAgent) session.userAgent = context.userAgent;
	if (typeof context.errors === "number") session.errors = context.errors;
	if (context.status) session.status = context.status;
}
function closeSession(session, status) {
	let context = {};
	if (status) context = { status };
	else if (session.status === "ok") context = { status: "exited" };
	updateSession(session, context);
}
function sessionToJSON(session) {
	return {
		sid: `${session.sid}`,
		init: session.init,
		started: (/* @__PURE__ */ new Date(session.started * 1e3)).toISOString(),
		timestamp: (/* @__PURE__ */ new Date(session.timestamp * 1e3)).toISOString(),
		status: session.status,
		errors: session.errors,
		did: typeof session.did === "number" || typeof session.did === "string" ? `${session.did}` : void 0,
		duration: session.duration,
		abnormal_mechanism: session.abnormal_mechanism,
		attrs: {
			release: session.release,
			environment: session.environment,
			ip_address: session.ipAddress,
			user_agent: session.userAgent
		}
	};
}
function merge(initialObj, mergeObj, levels = 2) {
	if (!mergeObj || typeof mergeObj !== "object" || levels <= 0) return mergeObj;
	if (initialObj && Object.keys(mergeObj).length === 0) return initialObj;
	const output = { ...initialObj };
	for (const key in mergeObj) if (Object.prototype.hasOwnProperty.call(mergeObj, key)) output[key] = merge(output[key], mergeObj[key], levels - 1);
	return output;
}
function generateTraceId() {
	return uuid4();
}
function generateSpanId() {
	return uuid4().substring(16);
}
var SCOPE_SPAN_FIELD = "_sentrySpan";
function _setSpanForScope(scope, span) {
	if (span) addNonEnumerableProperty(scope, SCOPE_SPAN_FIELD, span);
	else delete scope[SCOPE_SPAN_FIELD];
}
function _getSpanForScope(scope) {
	return scope[SCOPE_SPAN_FIELD];
}
var DEFAULT_MAX_BREADCRUMBS = 100;
var Scope = class Scope {
	constructor() {
		this._notifyingListeners = false;
		this._scopeListeners = [];
		this._eventProcessors = [];
		this._breadcrumbs = [];
		this._attachments = [];
		this._user = {};
		this._tags = {};
		this._extra = {};
		this._contexts = {};
		this._sdkProcessingMetadata = {};
		this._propagationContext = {
			traceId: generateTraceId(),
			sampleRand: Math.random()
		};
	}
	clone() {
		const newScope = new Scope();
		newScope._breadcrumbs = [...this._breadcrumbs];
		newScope._tags = { ...this._tags };
		newScope._extra = { ...this._extra };
		newScope._contexts = { ...this._contexts };
		if (this._contexts.flags) newScope._contexts.flags = { values: [...this._contexts.flags.values] };
		newScope._user = this._user;
		newScope._level = this._level;
		newScope._session = this._session;
		newScope._transactionName = this._transactionName;
		newScope._fingerprint = this._fingerprint;
		newScope._eventProcessors = [...this._eventProcessors];
		newScope._attachments = [...this._attachments];
		newScope._sdkProcessingMetadata = { ...this._sdkProcessingMetadata };
		newScope._propagationContext = { ...this._propagationContext };
		newScope._client = this._client;
		newScope._lastEventId = this._lastEventId;
		_setSpanForScope(newScope, _getSpanForScope(this));
		return newScope;
	}
	setClient(client) {
		this._client = client;
	}
	setLastEventId(lastEventId$1) {
		this._lastEventId = lastEventId$1;
	}
	getClient() {
		return this._client;
	}
	lastEventId() {
		return this._lastEventId;
	}
	addScopeListener(callback) {
		this._scopeListeners.push(callback);
	}
	addEventProcessor(callback) {
		this._eventProcessors.push(callback);
		return this;
	}
	setUser(user) {
		this._user = user || {
			email: void 0,
			id: void 0,
			ip_address: void 0,
			username: void 0
		};
		if (this._session) updateSession(this._session, { user });
		this._notifyScopeListeners();
		return this;
	}
	getUser() {
		return this._user;
	}
	setTags(tags) {
		this._tags = {
			...this._tags,
			...tags
		};
		this._notifyScopeListeners();
		return this;
	}
	setTag(key, value) {
		this._tags = {
			...this._tags,
			[key]: value
		};
		this._notifyScopeListeners();
		return this;
	}
	setExtras(extras) {
		this._extra = {
			...this._extra,
			...extras
		};
		this._notifyScopeListeners();
		return this;
	}
	setExtra(key, extra) {
		this._extra = {
			...this._extra,
			[key]: extra
		};
		this._notifyScopeListeners();
		return this;
	}
	setFingerprint(fingerprint) {
		this._fingerprint = fingerprint;
		this._notifyScopeListeners();
		return this;
	}
	setLevel(level) {
		this._level = level;
		this._notifyScopeListeners();
		return this;
	}
	setTransactionName(name) {
		this._transactionName = name;
		this._notifyScopeListeners();
		return this;
	}
	setContext(key, context) {
		if (context === null) delete this._contexts[key];
		else this._contexts[key] = context;
		this._notifyScopeListeners();
		return this;
	}
	setSession(session) {
		if (!session) delete this._session;
		else this._session = session;
		this._notifyScopeListeners();
		return this;
	}
	getSession() {
		return this._session;
	}
	update(captureContext) {
		if (!captureContext) return this;
		const scopeToMerge = typeof captureContext === "function" ? captureContext(this) : captureContext;
		const { tags, extra, user, contexts, level, fingerprint = [], propagationContext } = (scopeToMerge instanceof Scope ? scopeToMerge.getScopeData() : isPlainObject(scopeToMerge) ? captureContext : void 0) || {};
		this._tags = {
			...this._tags,
			...tags
		};
		this._extra = {
			...this._extra,
			...extra
		};
		this._contexts = {
			...this._contexts,
			...contexts
		};
		if (user && Object.keys(user).length) this._user = user;
		if (level) this._level = level;
		if (fingerprint.length) this._fingerprint = fingerprint;
		if (propagationContext) this._propagationContext = propagationContext;
		return this;
	}
	clear() {
		this._breadcrumbs = [];
		this._tags = {};
		this._extra = {};
		this._user = {};
		this._contexts = {};
		this._level = void 0;
		this._transactionName = void 0;
		this._fingerprint = void 0;
		this._session = void 0;
		_setSpanForScope(this, void 0);
		this._attachments = [];
		this.setPropagationContext({
			traceId: generateTraceId(),
			sampleRand: Math.random()
		});
		this._notifyScopeListeners();
		return this;
	}
	addBreadcrumb(breadcrumb, maxBreadcrumbs) {
		const maxCrumbs = typeof maxBreadcrumbs === "number" ? maxBreadcrumbs : DEFAULT_MAX_BREADCRUMBS;
		if (maxCrumbs <= 0) return this;
		const mergedBreadcrumb = {
			timestamp: dateTimestampInSeconds(),
			...breadcrumb,
			message: breadcrumb.message ? truncate(breadcrumb.message, 2048) : breadcrumb.message
		};
		this._breadcrumbs.push(mergedBreadcrumb);
		if (this._breadcrumbs.length > maxCrumbs) {
			this._breadcrumbs = this._breadcrumbs.slice(-maxCrumbs);
			this._client?.recordDroppedEvent("buffer_overflow", "log_item");
		}
		this._notifyScopeListeners();
		return this;
	}
	getLastBreadcrumb() {
		return this._breadcrumbs[this._breadcrumbs.length - 1];
	}
	clearBreadcrumbs() {
		this._breadcrumbs = [];
		this._notifyScopeListeners();
		return this;
	}
	addAttachment(attachment) {
		this._attachments.push(attachment);
		return this;
	}
	clearAttachments() {
		this._attachments = [];
		return this;
	}
	getScopeData() {
		return {
			breadcrumbs: this._breadcrumbs,
			attachments: this._attachments,
			contexts: this._contexts,
			tags: this._tags,
			extra: this._extra,
			user: this._user,
			level: this._level,
			fingerprint: this._fingerprint || [],
			eventProcessors: this._eventProcessors,
			propagationContext: this._propagationContext,
			sdkProcessingMetadata: this._sdkProcessingMetadata,
			transactionName: this._transactionName,
			span: _getSpanForScope(this)
		};
	}
	setSDKProcessingMetadata(newData) {
		this._sdkProcessingMetadata = merge(this._sdkProcessingMetadata, newData, 2);
		return this;
	}
	setPropagationContext(context) {
		this._propagationContext = context;
		return this;
	}
	getPropagationContext() {
		return this._propagationContext;
	}
	captureException(exception, hint) {
		const eventId = hint?.event_id || uuid4();
		if (!this._client) {
			DEBUG_BUILD$3 && debug.warn("No client configured on scope - will not capture exception!");
			return eventId;
		}
		const syntheticException = /* @__PURE__ */ new Error("Sentry syntheticException");
		this._client.captureException(exception, {
			originalException: exception,
			syntheticException,
			...hint,
			event_id: eventId
		}, this);
		return eventId;
	}
	captureMessage(message, level, hint) {
		const eventId = hint?.event_id || uuid4();
		if (!this._client) {
			DEBUG_BUILD$3 && debug.warn("No client configured on scope - will not capture message!");
			return eventId;
		}
		const syntheticException = new Error(message);
		this._client.captureMessage(message, level, {
			originalException: message,
			syntheticException,
			...hint,
			event_id: eventId
		}, this);
		return eventId;
	}
	captureEvent(event, hint) {
		const eventId = hint?.event_id || uuid4();
		if (!this._client) {
			DEBUG_BUILD$3 && debug.warn("No client configured on scope - will not capture event!");
			return eventId;
		}
		this._client.captureEvent(event, {
			...hint,
			event_id: eventId
		}, this);
		return eventId;
	}
	_notifyScopeListeners() {
		if (!this._notifyingListeners) {
			this._notifyingListeners = true;
			this._scopeListeners.forEach((callback) => {
				callback(this);
			});
			this._notifyingListeners = false;
		}
	}
};
function getDefaultCurrentScope() {
	return getGlobalSingleton("defaultCurrentScope", () => new Scope());
}
function getDefaultIsolationScope() {
	return getGlobalSingleton("defaultIsolationScope", () => new Scope());
}
var AsyncContextStack = class {
	constructor(scope, isolationScope) {
		let assignedScope;
		if (!scope) assignedScope = new Scope();
		else assignedScope = scope;
		let assignedIsolationScope;
		if (!isolationScope) assignedIsolationScope = new Scope();
		else assignedIsolationScope = isolationScope;
		this._stack = [{ scope: assignedScope }];
		this._isolationScope = assignedIsolationScope;
	}
	withScope(callback) {
		const scope = this._pushScope();
		let maybePromiseResult;
		try {
			maybePromiseResult = callback(scope);
		} catch (e) {
			this._popScope();
			throw e;
		}
		if (isThenable(maybePromiseResult)) return maybePromiseResult.then((res) => {
			this._popScope();
			return res;
		}, (e) => {
			this._popScope();
			throw e;
		});
		this._popScope();
		return maybePromiseResult;
	}
	getClient() {
		return this.getStackTop().client;
	}
	getScope() {
		return this.getStackTop().scope;
	}
	getIsolationScope() {
		return this._isolationScope;
	}
	getStackTop() {
		return this._stack[this._stack.length - 1];
	}
	_pushScope() {
		const scope = this.getScope().clone();
		this._stack.push({
			client: this.getClient(),
			scope
		});
		return scope;
	}
	_popScope() {
		if (this._stack.length <= 1) return false;
		return !!this._stack.pop();
	}
};
function getAsyncContextStack() {
	const sentry = getSentryCarrier(getMainCarrier());
	return sentry.stack = sentry.stack || new AsyncContextStack(getDefaultCurrentScope(), getDefaultIsolationScope());
}
function withScope$1(callback) {
	return getAsyncContextStack().withScope(callback);
}
function withSetScope(scope, callback) {
	const stack = getAsyncContextStack();
	return stack.withScope(() => {
		stack.getStackTop().scope = scope;
		return callback(scope);
	});
}
function withIsolationScope$1(callback) {
	return getAsyncContextStack().withScope(() => {
		return callback(getAsyncContextStack().getIsolationScope());
	});
}
function getStackAsyncContextStrategy() {
	return {
		withIsolationScope: withIsolationScope$1,
		withScope: withScope$1,
		withSetScope,
		withSetIsolationScope: (_isolationScope, callback) => {
			return withIsolationScope$1(callback);
		},
		getCurrentScope: () => getAsyncContextStack().getScope(),
		getIsolationScope: () => getAsyncContextStack().getIsolationScope()
	};
}
function getAsyncContextStrategy(carrier) {
	const sentry = getSentryCarrier(carrier);
	if (sentry.acs) return sentry.acs;
	return getStackAsyncContextStrategy();
}
function getCurrentScope() {
	return getAsyncContextStrategy(getMainCarrier()).getCurrentScope();
}
function getIsolationScope() {
	return getAsyncContextStrategy(getMainCarrier()).getIsolationScope();
}
function getGlobalScope() {
	return getGlobalSingleton("globalScope", () => new Scope());
}
function withScope(...rest) {
	const acs = getAsyncContextStrategy(getMainCarrier());
	if (rest.length === 2) {
		const [scope, callback] = rest;
		if (!scope) return acs.withScope(callback);
		return acs.withSetScope(scope, callback);
	}
	return acs.withScope(rest[0]);
}
function getClient() {
	return getCurrentScope().getClient();
}
function getTraceContextFromScope(scope) {
	const { traceId, parentSpanId, propagationSpanId } = scope.getPropagationContext();
	const traceContext = {
		trace_id: traceId,
		span_id: propagationSpanId || generateSpanId()
	};
	if (parentSpanId) traceContext.parent_span_id = parentSpanId;
	return traceContext;
}
var SEMANTIC_ATTRIBUTE_SENTRY_SOURCE = "sentry.source";
var SEMANTIC_ATTRIBUTE_SENTRY_OP = "sentry.op";
var SEMANTIC_ATTRIBUTE_SENTRY_ORIGIN = "sentry.origin";
var SEMANTIC_ATTRIBUTE_PROFILE_ID = "sentry.profile_id";
var SEMANTIC_ATTRIBUTE_EXCLUSIVE_TIME = "sentry.exclusive_time";
var SCOPE_ON_START_SPAN_FIELD = "_sentryScope";
var ISOLATION_SCOPE_ON_START_SPAN_FIELD = "_sentryIsolationScope";
function getCapturedScopesOnSpan(span) {
	return {
		scope: span[SCOPE_ON_START_SPAN_FIELD],
		isolationScope: span[ISOLATION_SCOPE_ON_START_SPAN_FIELD]
	};
}
var SENTRY_BAGGAGE_KEY_PREFIX_REGEX = /^sentry-/;
function baggageHeaderToDynamicSamplingContext(baggageHeader) {
	const baggageObject = parseBaggageHeader(baggageHeader);
	if (!baggageObject) return;
	const dynamicSamplingContext = Object.entries(baggageObject).reduce((acc, [key, value]) => {
		if (key.match(SENTRY_BAGGAGE_KEY_PREFIX_REGEX)) {
			const nonPrefixedKey = key.slice(7);
			acc[nonPrefixedKey] = value;
		}
		return acc;
	}, {});
	if (Object.keys(dynamicSamplingContext).length > 0) return dynamicSamplingContext;
	else return;
}
function parseBaggageHeader(baggageHeader) {
	if (!baggageHeader || !isString(baggageHeader) && !Array.isArray(baggageHeader)) return;
	if (Array.isArray(baggageHeader)) return baggageHeader.reduce((acc, curr) => {
		const currBaggageObject = baggageHeaderToObject(curr);
		Object.entries(currBaggageObject).forEach(([key, value]) => {
			acc[key] = value;
		});
		return acc;
	}, {});
	return baggageHeaderToObject(baggageHeader);
}
function baggageHeaderToObject(baggageHeader) {
	return baggageHeader.split(",").map((baggageEntry) => baggageEntry.split("=").map((keyOrValue) => {
		try {
			return decodeURIComponent(keyOrValue.trim());
		} catch {
			return;
		}
	})).reduce((acc, [key, value]) => {
		if (key && value) acc[key] = value;
		return acc;
	}, {});
}
function parseSampleRate(sampleRate) {
	if (typeof sampleRate === "boolean") return Number(sampleRate);
	const rate = typeof sampleRate === "string" ? parseFloat(sampleRate) : sampleRate;
	if (typeof rate !== "number" || isNaN(rate) || rate < 0 || rate > 1) return;
	return rate;
}
var hasShownSpanDropWarning = false;
function spanToTraceContext(span) {
	const { spanId, traceId: trace_id, isRemote } = span.spanContext();
	const parent_span_id = isRemote ? spanId : spanToJSON(span).parent_span_id;
	const scope = getCapturedScopesOnSpan(span).scope;
	return {
		parent_span_id,
		span_id: isRemote ? scope?.getPropagationContext().propagationSpanId || generateSpanId() : spanId,
		trace_id
	};
}
function convertSpanLinksForEnvelope(links) {
	if (links && links.length > 0) return links.map(({ context: { spanId, traceId, traceFlags, ...restContext }, attributes }) => ({
		span_id: spanId,
		trace_id: traceId,
		sampled: traceFlags === 1,
		attributes,
		...restContext
	}));
	else return;
}
function spanTimeInputToSeconds(input) {
	if (typeof input === "number") return ensureTimestampInSeconds(input);
	if (Array.isArray(input)) return input[0] + input[1] / 1e9;
	if (input instanceof Date) return ensureTimestampInSeconds(input.getTime());
	return timestampInSeconds();
}
function ensureTimestampInSeconds(timestamp) {
	return timestamp > 9999999999 ? timestamp / 1e3 : timestamp;
}
function spanToJSON(span) {
	if (spanIsSentrySpan(span)) return span.getSpanJSON();
	const { spanId: span_id, traceId: trace_id } = span.spanContext();
	if (spanIsOpenTelemetrySdkTraceBaseSpan(span)) {
		const { attributes, startTime, name, endTime, status, links } = span;
		return {
			span_id,
			trace_id,
			data: attributes,
			description: name,
			parent_span_id: "parentSpanId" in span ? span.parentSpanId : "parentSpanContext" in span ? span.parentSpanContext?.spanId : void 0,
			start_timestamp: spanTimeInputToSeconds(startTime),
			timestamp: spanTimeInputToSeconds(endTime) || void 0,
			status: getStatusMessage(status),
			op: attributes[SEMANTIC_ATTRIBUTE_SENTRY_OP],
			origin: attributes[SEMANTIC_ATTRIBUTE_SENTRY_ORIGIN],
			links: convertSpanLinksForEnvelope(links)
		};
	}
	return {
		span_id,
		trace_id,
		start_timestamp: 0,
		data: {}
	};
}
function spanIsOpenTelemetrySdkTraceBaseSpan(span) {
	const castSpan = span;
	return !!castSpan.attributes && !!castSpan.startTime && !!castSpan.name && !!castSpan.endTime && !!castSpan.status;
}
function spanIsSentrySpan(span) {
	return typeof span.getSpanJSON === "function";
}
function spanIsSampled(span) {
	const { traceFlags } = span.spanContext();
	return traceFlags === 1;
}
function getStatusMessage(status) {
	if (!status || status.code === 0) return;
	if (status.code === 1) return "ok";
	return status.message || "unknown_error";
}
var ROOT_SPAN_FIELD = "_sentryRootSpan";
function getRootSpan(span) {
	return span[ROOT_SPAN_FIELD] || span;
}
function showSpanDropWarning() {
	if (!hasShownSpanDropWarning) {
		consoleSandbox(() => {
			console.warn("[Sentry] Returning null from `beforeSendSpan` is disallowed. To drop certain spans, configure the respective integrations directly.");
		});
		hasShownSpanDropWarning = true;
	}
}
function hasSpansEnabled(maybeOptions) {
	if (typeof __SENTRY_TRACING__ === "boolean" && !__SENTRY_TRACING__) return false;
	const options = maybeOptions || getClient()?.getOptions();
	return !!options && (options.tracesSampleRate != null || !!options.tracesSampler);
}
var DEFAULT_ENVIRONMENT = "production";
var ORG_ID_REGEX = /^o(\d+)\./;
var DSN_REGEX = /^(?:(\w+):)\/\/(?:(\w+)(?::(\w+)?)?@)([\w.-]+)(?::(\d+))?\/(.+)/;
function isValidProtocol(protocol) {
	return protocol === "http" || protocol === "https";
}
function dsnToString(dsn, withPassword = false) {
	const { host, path, pass, port, projectId, protocol, publicKey } = dsn;
	return `${protocol}://${publicKey}${withPassword && pass ? `:${pass}` : ""}@${host}${port ? `:${port}` : ""}/${path ? `${path}/` : path}${projectId}`;
}
function dsnFromString(str) {
	const match = DSN_REGEX.exec(str);
	if (!match) {
		consoleSandbox(() => {
			console.error(`Invalid Sentry Dsn: ${str}`);
		});
		return;
	}
	const [protocol, publicKey, pass = "", host = "", port = "", lastPath = ""] = match.slice(1);
	let path = "";
	let projectId = lastPath;
	const split = projectId.split("/");
	if (split.length > 1) {
		path = split.slice(0, -1).join("/");
		projectId = split.pop();
	}
	if (projectId) {
		const projectMatch = projectId.match(/^\d+/);
		if (projectMatch) projectId = projectMatch[0];
	}
	return dsnFromComponents({
		host,
		pass,
		path,
		projectId,
		port,
		protocol,
		publicKey
	});
}
function dsnFromComponents(components) {
	return {
		protocol: components.protocol,
		publicKey: components.publicKey || "",
		pass: components.pass || "",
		host: components.host,
		port: components.port || "",
		path: components.path || "",
		projectId: components.projectId
	};
}
function validateDsn(dsn) {
	if (!DEBUG_BUILD$3) return true;
	const { port, projectId, protocol } = dsn;
	if ([
		"protocol",
		"publicKey",
		"host",
		"projectId"
	].find((component) => {
		if (!dsn[component]) {
			debug.error(`Invalid Sentry Dsn: ${component} missing`);
			return true;
		}
		return false;
	})) return false;
	if (!projectId.match(/^\d+$/)) {
		debug.error(`Invalid Sentry Dsn: Invalid projectId ${projectId}`);
		return false;
	}
	if (!isValidProtocol(protocol)) {
		debug.error(`Invalid Sentry Dsn: Invalid protocol ${protocol}`);
		return false;
	}
	if (port && isNaN(parseInt(port, 10))) {
		debug.error(`Invalid Sentry Dsn: Invalid port ${port}`);
		return false;
	}
	return true;
}
function extractOrgIdFromDsnHost(host) {
	return host.match(ORG_ID_REGEX)?.[1];
}
function makeDsn(from) {
	const components = typeof from === "string" ? dsnFromString(from) : dsnFromComponents(from);
	if (!components || !validateDsn(components)) return;
	return components;
}
var FROZEN_DSC_FIELD = "_frozenDsc";
function getDynamicSamplingContextFromClient(trace_id, client) {
	const options = client.getOptions();
	const { publicKey: public_key, host } = client.getDsn() || {};
	let org_id;
	if (options.orgId) org_id = String(options.orgId);
	else if (host) org_id = extractOrgIdFromDsnHost(host);
	const dsc = {
		environment: options.environment || "production",
		release: options.release,
		public_key,
		trace_id,
		org_id
	};
	client.emit("createDsc", dsc);
	return dsc;
}
function getDynamicSamplingContextFromScope(client, scope) {
	const propagationContext = scope.getPropagationContext();
	return propagationContext.dsc || getDynamicSamplingContextFromClient(propagationContext.traceId, client);
}
function getDynamicSamplingContextFromSpan(span) {
	const client = getClient();
	if (!client) return {};
	const rootSpan = getRootSpan(span);
	const rootSpanJson = spanToJSON(rootSpan);
	const rootSpanAttributes = rootSpanJson.data;
	const traceState = rootSpan.spanContext().traceState;
	const rootSpanSampleRate = traceState?.get("sentry.sample_rate") ?? rootSpanAttributes["sentry.sample_rate"] ?? rootSpanAttributes["sentry.previous_trace_sample_rate"];
	function applyLocalSampleRateToDsc(dsc$1) {
		if (typeof rootSpanSampleRate === "number" || typeof rootSpanSampleRate === "string") dsc$1.sample_rate = `${rootSpanSampleRate}`;
		return dsc$1;
	}
	const frozenDsc = rootSpan[FROZEN_DSC_FIELD];
	if (frozenDsc) return applyLocalSampleRateToDsc(frozenDsc);
	const traceStateDsc = traceState?.get("sentry.dsc");
	const dscOnTraceState = traceStateDsc && baggageHeaderToDynamicSamplingContext(traceStateDsc);
	if (dscOnTraceState) return applyLocalSampleRateToDsc(dscOnTraceState);
	const dsc = getDynamicSamplingContextFromClient(span.spanContext().traceId, client);
	const source = rootSpanAttributes[SEMANTIC_ATTRIBUTE_SENTRY_SOURCE];
	const name = rootSpanJson.description;
	if (source !== "url" && name) dsc.transaction = name;
	if (hasSpansEnabled()) {
		dsc.sampled = String(spanIsSampled(rootSpan));
		dsc.sample_rand = traceState?.get("sentry.sample_rand") ?? getCapturedScopesOnSpan(rootSpan).scope?.getPropagationContext().sampleRand.toString();
	}
	applyLocalSampleRateToDsc(dsc);
	client.emit("createDsc", dsc, rootSpan);
	return dsc;
}
function normalize(input, depth = 100, maxProperties = Infinity) {
	try {
		return visit("", input, depth, maxProperties);
	} catch (err) {
		return { ERROR: `**non-serializable** (${err})` };
	}
}
function normalizeToSize(object, depth = 3, maxSize = 100 * 1024) {
	const normalized = normalize(object, depth);
	if (jsonSize(normalized) > maxSize) return normalizeToSize(object, depth - 1, maxSize);
	return normalized;
}
function visit(key, value, depth = Infinity, maxProperties = Infinity, memo = memoBuilder()) {
	const [memoize, unmemoize] = memo;
	if (value == null || ["boolean", "string"].includes(typeof value) || typeof value === "number" && Number.isFinite(value)) return value;
	const stringified = stringifyValue(key, value);
	if (!stringified.startsWith("[object ")) return stringified;
	if (value["__sentry_skip_normalization__"]) return value;
	const remainingDepth = typeof value["__sentry_override_normalization_depth__"] === "number" ? value["__sentry_override_normalization_depth__"] : depth;
	if (remainingDepth === 0) return stringified.replace("object ", "");
	if (memoize(value)) return "[Circular ~]";
	const valueWithToJSON = value;
	if (valueWithToJSON && typeof valueWithToJSON.toJSON === "function") try {
		return visit("", valueWithToJSON.toJSON(), remainingDepth - 1, maxProperties, memo);
	} catch {}
	const normalized = Array.isArray(value) ? [] : {};
	let numAdded = 0;
	const visitable = convertToPlainObject(value);
	for (const visitKey in visitable) {
		if (!Object.prototype.hasOwnProperty.call(visitable, visitKey)) continue;
		if (numAdded >= maxProperties) {
			normalized[visitKey] = "[MaxProperties ~]";
			break;
		}
		const visitValue = visitable[visitKey];
		normalized[visitKey] = visit(visitKey, visitValue, remainingDepth - 1, maxProperties, memo);
		numAdded++;
	}
	unmemoize(value);
	return normalized;
}
function stringifyValue(key, value) {
	try {
		if (key === "domain" && value && typeof value === "object" && value._events) return "[Domain]";
		if (key === "domainEmitter") return "[DomainEmitter]";
		if (typeof global !== "undefined" && value === global) return "[Global]";
		if (typeof window !== "undefined" && value === window) return "[Window]";
		if (typeof document !== "undefined" && value === document) return "[Document]";
		if (isVueViewModel(value)) return "[VueViewModel]";
		if (isSyntheticEvent(value)) return "[SyntheticEvent]";
		if (typeof value === "number" && !Number.isFinite(value)) return `[${value}]`;
		if (typeof value === "function") return `[Function: ${getFunctionName(value)}]`;
		if (typeof value === "symbol") return `[${String(value)}]`;
		if (typeof value === "bigint") return `[BigInt: ${String(value)}]`;
		const objName = getConstructorName(value);
		if (/^HTML(\w*)Element$/.test(objName)) return `[HTMLElement: ${objName}]`;
		return `[object ${objName}]`;
	} catch (err) {
		return `**non-serializable** (${err})`;
	}
}
function getConstructorName(value) {
	const prototype = Object.getPrototypeOf(value);
	return prototype?.constructor ? prototype.constructor.name : "null prototype";
}
function utf8Length(value) {
	return ~-encodeURI(value).split(/%..|./).length;
}
function jsonSize(value) {
	return utf8Length(JSON.stringify(value));
}
function memoBuilder() {
	const inner = /* @__PURE__ */ new WeakSet();
	function memoize(obj) {
		if (inner.has(obj)) return true;
		inner.add(obj);
		return false;
	}
	function unmemoize(obj) {
		inner.delete(obj);
	}
	return [memoize, unmemoize];
}
function createEnvelope(headers, items = []) {
	return [headers, items];
}
function addItemToEnvelope(envelope, newItem) {
	const [headers, items] = envelope;
	return [headers, [...items, newItem]];
}
function forEachEnvelopeItem(envelope, callback) {
	const envelopeItems = envelope[1];
	for (const envelopeItem of envelopeItems) {
		const envelopeItemType = envelopeItem[0].type;
		if (callback(envelopeItem, envelopeItemType)) return true;
	}
	return false;
}
function encodeUTF8(input) {
	const carrier = getSentryCarrier(GLOBAL_OBJ);
	return carrier.encodePolyfill ? carrier.encodePolyfill(input) : new TextEncoder().encode(input);
}
function serializeEnvelope(envelope) {
	const [envHeaders, items] = envelope;
	let parts = JSON.stringify(envHeaders);
	function append(next) {
		if (typeof parts === "string") parts = typeof next === "string" ? parts + next : [encodeUTF8(parts), next];
		else parts.push(typeof next === "string" ? encodeUTF8(next) : next);
	}
	for (const item of items) {
		const [itemHeaders, payload] = item;
		append(`\n${JSON.stringify(itemHeaders)}\n`);
		if (typeof payload === "string" || payload instanceof Uint8Array) append(payload);
		else {
			let stringifiedPayload;
			try {
				stringifiedPayload = JSON.stringify(payload);
			} catch {
				stringifiedPayload = JSON.stringify(normalize(payload));
			}
			append(stringifiedPayload);
		}
	}
	return typeof parts === "string" ? parts : concatBuffers(parts);
}
function concatBuffers(buffers) {
	const totalLength = buffers.reduce((acc, buf) => acc + buf.length, 0);
	const merged = new Uint8Array(totalLength);
	let offset$3 = 0;
	for (const buffer of buffers) {
		merged.set(buffer, offset$3);
		offset$3 += buffer.length;
	}
	return merged;
}
function createAttachmentEnvelopeItem(attachment) {
	const buffer = typeof attachment.data === "string" ? encodeUTF8(attachment.data) : attachment.data;
	return [{
		type: "attachment",
		length: buffer.length,
		filename: attachment.filename,
		content_type: attachment.contentType,
		attachment_type: attachment.attachmentType
	}, buffer];
}
var ITEM_TYPE_TO_DATA_CATEGORY_MAP = {
	session: "session",
	sessions: "session",
	attachment: "attachment",
	transaction: "transaction",
	event: "error",
	client_report: "internal",
	user_report: "default",
	profile: "profile",
	profile_chunk: "profile",
	replay_event: "replay",
	replay_recording: "replay",
	check_in: "monitor",
	feedback: "feedback",
	span: "span",
	raw_security: "security",
	log: "log_item"
};
function envelopeItemTypeToDataCategory(type) {
	return ITEM_TYPE_TO_DATA_CATEGORY_MAP[type];
}
function getSdkMetadataForEnvelopeHeader(metadataOrEvent) {
	if (!metadataOrEvent?.sdk) return;
	const { name, version: version$2 } = metadataOrEvent.sdk;
	return {
		name,
		version: version$2
	};
}
function createEventEnvelopeHeaders(event, sdkInfo, tunnel, dsn) {
	const dynamicSamplingContext = event.sdkProcessingMetadata?.dynamicSamplingContext;
	return {
		event_id: event.event_id,
		sent_at: (/* @__PURE__ */ new Date()).toISOString(),
		...sdkInfo && { sdk: sdkInfo },
		...!!tunnel && dsn && { dsn: dsnToString(dsn) },
		...dynamicSamplingContext && { trace: dynamicSamplingContext }
	};
}
function enhanceEventWithSdkInfo(event, sdkInfo) {
	if (!sdkInfo) return event;
	event.sdk = event.sdk || {};
	event.sdk.name = event.sdk.name || sdkInfo.name;
	event.sdk.version = event.sdk.version || sdkInfo.version;
	event.sdk.integrations = [...event.sdk.integrations || [], ...sdkInfo.integrations || []];
	event.sdk.packages = [...event.sdk.packages || [], ...sdkInfo.packages || []];
	return event;
}
function createSessionEnvelope(session, dsn, metadata, tunnel) {
	const sdkInfo = getSdkMetadataForEnvelopeHeader(metadata);
	return createEnvelope({
		sent_at: (/* @__PURE__ */ new Date()).toISOString(),
		...sdkInfo && { sdk: sdkInfo },
		...!!tunnel && dsn && { dsn: dsnToString(dsn) }
	}, ["aggregates" in session ? [{ type: "sessions" }, session] : [{ type: "session" }, session.toJSON()]]);
}
function createEventEnvelope(event, dsn, metadata, tunnel) {
	const sdkInfo = getSdkMetadataForEnvelopeHeader(metadata);
	const eventType = event.type && event.type !== "replay_event" ? event.type : "event";
	enhanceEventWithSdkInfo(event, metadata?.sdk);
	const envelopeHeaders = createEventEnvelopeHeaders(event, sdkInfo, tunnel, dsn);
	delete event.sdkProcessingMetadata;
	return createEnvelope(envelopeHeaders, [[{ type: eventType }, event]]);
}
var STATE_PENDING = 0;
var STATE_RESOLVED = 1;
var STATE_REJECTED = 2;
function resolvedSyncPromise(value) {
	return new SyncPromise((resolve) => {
		resolve(value);
	});
}
function rejectedSyncPromise(reason) {
	return new SyncPromise((_$1, reject) => {
		reject(reason);
	});
}
var SyncPromise = class SyncPromise {
	constructor(executor) {
		this._state = STATE_PENDING;
		this._handlers = [];
		this._runExecutor(executor);
	}
	then(onfulfilled, onrejected) {
		return new SyncPromise((resolve, reject) => {
			this._handlers.push([
				false,
				(result) => {
					if (!onfulfilled) resolve(result);
					else try {
						resolve(onfulfilled(result));
					} catch (e) {
						reject(e);
					}
				},
				(reason) => {
					if (!onrejected) reject(reason);
					else try {
						resolve(onrejected(reason));
					} catch (e) {
						reject(e);
					}
				}
			]);
			this._executeHandlers();
		});
	}
	catch(onrejected) {
		return this.then((val) => val, onrejected);
	}
	finally(onfinally) {
		return new SyncPromise((resolve, reject) => {
			let val;
			let isRejected;
			return this.then((value) => {
				isRejected = false;
				val = value;
				if (onfinally) onfinally();
			}, (reason) => {
				isRejected = true;
				val = reason;
				if (onfinally) onfinally();
			}).then(() => {
				if (isRejected) {
					reject(val);
					return;
				}
				resolve(val);
			});
		});
	}
	_executeHandlers() {
		if (this._state === STATE_PENDING) return;
		const cachedHandlers = this._handlers.slice();
		this._handlers = [];
		cachedHandlers.forEach((handler) => {
			if (handler[0]) return;
			if (this._state === STATE_RESOLVED) handler[1](this._value);
			if (this._state === STATE_REJECTED) handler[2](this._value);
			handler[0] = true;
		});
	}
	_runExecutor(executor) {
		const setResult = (state, value) => {
			if (this._state !== STATE_PENDING) return;
			if (isThenable(value)) {
				value.then(resolve, reject);
				return;
			}
			this._state = state;
			this._value = value;
			this._executeHandlers();
		};
		const resolve = (value) => {
			setResult(STATE_RESOLVED, value);
		};
		const reject = (reason) => {
			setResult(STATE_REJECTED, reason);
		};
		try {
			executor(resolve, reject);
		} catch (e) {
			reject(e);
		}
	}
};
function notifyEventProcessors(processors, event, hint, index$1 = 0) {
	return new SyncPromise((resolve, reject) => {
		const processor = processors[index$1];
		if (event === null || typeof processor !== "function") resolve(event);
		else {
			const result = processor({ ...event }, hint);
			DEBUG_BUILD$3 && processor.id && result === null && debug.log(`Event processor "${processor.id}" dropped event`);
			if (isThenable(result)) result.then((final) => notifyEventProcessors(processors, final, hint, index$1 + 1).then(resolve)).then(null, reject);
			else notifyEventProcessors(processors, result, hint, index$1 + 1).then(resolve).then(null, reject);
		}
	});
}
function applyScopeDataToEvent(event, data) {
	const { fingerprint, span, breadcrumbs, sdkProcessingMetadata } = data;
	applyDataToEvent(event, data);
	if (span) applySpanToEvent(event, span);
	applyFingerprintToEvent(event, fingerprint);
	applyBreadcrumbsToEvent(event, breadcrumbs);
	applySdkMetadataToEvent(event, sdkProcessingMetadata);
}
function mergeScopeData(data, mergeData) {
	const { extra, tags, user, contexts, level, sdkProcessingMetadata, breadcrumbs, fingerprint, eventProcessors, attachments, propagationContext, transactionName, span } = mergeData;
	mergeAndOverwriteScopeData(data, "extra", extra);
	mergeAndOverwriteScopeData(data, "tags", tags);
	mergeAndOverwriteScopeData(data, "user", user);
	mergeAndOverwriteScopeData(data, "contexts", contexts);
	data.sdkProcessingMetadata = merge(data.sdkProcessingMetadata, sdkProcessingMetadata, 2);
	if (level) data.level = level;
	if (transactionName) data.transactionName = transactionName;
	if (span) data.span = span;
	if (breadcrumbs.length) data.breadcrumbs = [...data.breadcrumbs, ...breadcrumbs];
	if (fingerprint.length) data.fingerprint = [...data.fingerprint, ...fingerprint];
	if (eventProcessors.length) data.eventProcessors = [...data.eventProcessors, ...eventProcessors];
	if (attachments.length) data.attachments = [...data.attachments, ...attachments];
	data.propagationContext = {
		...data.propagationContext,
		...propagationContext
	};
}
function mergeAndOverwriteScopeData(data, prop, mergeVal) {
	data[prop] = merge(data[prop], mergeVal, 1);
}
function applyDataToEvent(event, data) {
	const { extra, tags, user, contexts, level, transactionName } = data;
	if (Object.keys(extra).length) event.extra = {
		...extra,
		...event.extra
	};
	if (Object.keys(tags).length) event.tags = {
		...tags,
		...event.tags
	};
	if (Object.keys(user).length) event.user = {
		...user,
		...event.user
	};
	if (Object.keys(contexts).length) event.contexts = {
		...contexts,
		...event.contexts
	};
	if (level) event.level = level;
	if (transactionName && event.type !== "transaction") event.transaction = transactionName;
}
function applyBreadcrumbsToEvent(event, breadcrumbs) {
	const mergedBreadcrumbs = [...event.breadcrumbs || [], ...breadcrumbs];
	event.breadcrumbs = mergedBreadcrumbs.length ? mergedBreadcrumbs : void 0;
}
function applySdkMetadataToEvent(event, sdkProcessingMetadata) {
	event.sdkProcessingMetadata = {
		...event.sdkProcessingMetadata,
		...sdkProcessingMetadata
	};
}
function applySpanToEvent(event, span) {
	event.contexts = {
		trace: spanToTraceContext(span),
		...event.contexts
	};
	event.sdkProcessingMetadata = {
		dynamicSamplingContext: getDynamicSamplingContextFromSpan(span),
		...event.sdkProcessingMetadata
	};
	const transactionName = spanToJSON(getRootSpan(span)).description;
	if (transactionName && !event.transaction && event.type === "transaction") event.transaction = transactionName;
}
function applyFingerprintToEvent(event, fingerprint) {
	event.fingerprint = event.fingerprint ? Array.isArray(event.fingerprint) ? event.fingerprint : [event.fingerprint] : [];
	if (fingerprint) event.fingerprint = event.fingerprint.concat(fingerprint);
	if (!event.fingerprint.length) delete event.fingerprint;
}
var parsedStackResults;
var lastKeysCount;
var cachedFilenameDebugIds;
function getFilenameToDebugIdMap(stackParser) {
	const debugIdMap = GLOBAL_OBJ._sentryDebugIds;
	if (!debugIdMap) return {};
	const debugIdKeys = Object.keys(debugIdMap);
	if (cachedFilenameDebugIds && debugIdKeys.length === lastKeysCount) return cachedFilenameDebugIds;
	lastKeysCount = debugIdKeys.length;
	cachedFilenameDebugIds = debugIdKeys.reduce((acc, stackKey) => {
		if (!parsedStackResults) parsedStackResults = {};
		const result = parsedStackResults[stackKey];
		if (result) acc[result[0]] = result[1];
		else {
			const parsedStack = stackParser(stackKey);
			for (let i = parsedStack.length - 1; i >= 0; i--) {
				const filename = parsedStack[i]?.filename;
				const debugId = debugIdMap[stackKey];
				if (filename && debugId) {
					acc[filename] = debugId;
					parsedStackResults[stackKey] = [filename, debugId];
					break;
				}
			}
		}
		return acc;
	}, {});
	return cachedFilenameDebugIds;
}
function prepareEvent(options, event, hint, scope, client, isolationScope) {
	const { normalizeDepth = 3, normalizeMaxBreadth = 1e3 } = options;
	const prepared = {
		...event,
		event_id: event.event_id || hint.event_id || uuid4(),
		timestamp: event.timestamp || dateTimestampInSeconds()
	};
	const integrations = hint.integrations || options.integrations.map((i) => i.name);
	applyClientOptions(prepared, options);
	applyIntegrationsMetadata(prepared, integrations);
	if (client) client.emit("applyFrameMetadata", event);
	if (event.type === void 0) applyDebugIds(prepared, options.stackParser);
	const finalScope = getFinalScope(scope, hint.captureContext);
	if (hint.mechanism) addExceptionMechanism(prepared, hint.mechanism);
	const clientEventProcessors = client ? client.getEventProcessors() : [];
	const data = getGlobalScope().getScopeData();
	if (isolationScope) mergeScopeData(data, isolationScope.getScopeData());
	if (finalScope) mergeScopeData(data, finalScope.getScopeData());
	const attachments = [...hint.attachments || [], ...data.attachments];
	if (attachments.length) hint.attachments = attachments;
	applyScopeDataToEvent(prepared, data);
	return notifyEventProcessors([...clientEventProcessors, ...data.eventProcessors], prepared, hint).then((evt) => {
		if (evt) applyDebugMeta(evt);
		if (typeof normalizeDepth === "number" && normalizeDepth > 0) return normalizeEvent(evt, normalizeDepth, normalizeMaxBreadth);
		return evt;
	});
}
function applyClientOptions(event, options) {
	const { environment, release, dist, maxValueLength = 250 } = options;
	event.environment = event.environment || environment || "production";
	if (!event.release && release) event.release = release;
	if (!event.dist && dist) event.dist = dist;
	const request = event.request;
	if (request?.url) request.url = truncate(request.url, maxValueLength);
}
function applyDebugIds(event, stackParser) {
	const filenameDebugIdMap = getFilenameToDebugIdMap(stackParser);
	event.exception?.values?.forEach((exception) => {
		exception.stacktrace?.frames?.forEach((frame) => {
			if (frame.filename) frame.debug_id = filenameDebugIdMap[frame.filename];
		});
	});
}
function applyDebugMeta(event) {
	const filenameDebugIdMap = {};
	event.exception?.values?.forEach((exception) => {
		exception.stacktrace?.frames?.forEach((frame) => {
			if (frame.debug_id) {
				if (frame.abs_path) filenameDebugIdMap[frame.abs_path] = frame.debug_id;
				else if (frame.filename) filenameDebugIdMap[frame.filename] = frame.debug_id;
				delete frame.debug_id;
			}
		});
	});
	if (Object.keys(filenameDebugIdMap).length === 0) return;
	event.debug_meta = event.debug_meta || {};
	event.debug_meta.images = event.debug_meta.images || [];
	const images = event.debug_meta.images;
	Object.entries(filenameDebugIdMap).forEach(([filename, debug_id]) => {
		images.push({
			type: "sourcemap",
			code_file: filename,
			debug_id
		});
	});
}
function applyIntegrationsMetadata(event, integrationNames) {
	if (integrationNames.length > 0) {
		event.sdk = event.sdk || {};
		event.sdk.integrations = [...event.sdk.integrations || [], ...integrationNames];
	}
}
function normalizeEvent(event, depth, maxBreadth) {
	if (!event) return null;
	const normalized = {
		...event,
		...event.breadcrumbs && { breadcrumbs: event.breadcrumbs.map((b$1) => ({
			...b$1,
			...b$1.data && { data: normalize(b$1.data, depth, maxBreadth) }
		})) },
		...event.user && { user: normalize(event.user, depth, maxBreadth) },
		...event.contexts && { contexts: normalize(event.contexts, depth, maxBreadth) },
		...event.extra && { extra: normalize(event.extra, depth, maxBreadth) }
	};
	if (event.contexts?.trace && normalized.contexts) {
		normalized.contexts.trace = event.contexts.trace;
		if (event.contexts.trace.data) normalized.contexts.trace.data = normalize(event.contexts.trace.data, depth, maxBreadth);
	}
	if (event.spans) normalized.spans = event.spans.map((span) => {
		return {
			...span,
			...span.data && { data: normalize(span.data, depth, maxBreadth) }
		};
	});
	if (event.contexts?.flags && normalized.contexts) normalized.contexts.flags = normalize(event.contexts.flags, 3, maxBreadth);
	return normalized;
}
function getFinalScope(scope, captureContext) {
	if (!captureContext) return scope;
	const finalScope = scope ? scope.clone() : new Scope();
	finalScope.update(captureContext);
	return finalScope;
}
function parseEventHintOrCaptureContext(hint) {
	if (!hint) return;
	if (hintIsScopeOrFunction(hint)) return { captureContext: hint };
	if (hintIsScopeContext(hint)) return { captureContext: hint };
	return hint;
}
function hintIsScopeOrFunction(hint) {
	return hint instanceof Scope || typeof hint === "function";
}
var captureContextKeys = [
	"user",
	"level",
	"extra",
	"contexts",
	"tags",
	"fingerprint",
	"propagationContext"
];
function hintIsScopeContext(hint) {
	return Object.keys(hint).some((key) => captureContextKeys.includes(key));
}
function captureException(exception, hint) {
	return getCurrentScope().captureException(exception, parseEventHintOrCaptureContext(hint));
}
function captureEvent(event, hint) {
	return getCurrentScope().captureEvent(event, hint);
}
function setContext(name, context) {
	getIsolationScope().setContext(name, context);
}
function lastEventId() {
	return getIsolationScope().lastEventId();
}
function startSession(context) {
	const isolationScope = getIsolationScope();
	const currentScope = getCurrentScope();
	const { userAgent } = GLOBAL_OBJ.navigator || {};
	const session = makeSession({
		user: currentScope.getUser() || isolationScope.getUser(),
		...userAgent && { userAgent },
		...context
	});
	const currentSession = isolationScope.getSession();
	if (currentSession?.status === "ok") updateSession(currentSession, { status: "exited" });
	endSession();
	isolationScope.setSession(session);
	return session;
}
function endSession() {
	const isolationScope = getIsolationScope();
	const session = getCurrentScope().getSession() || isolationScope.getSession();
	if (session) closeSession(session);
	_sendSessionUpdate();
	isolationScope.setSession();
}
function _sendSessionUpdate() {
	const isolationScope = getIsolationScope();
	const client = getClient();
	const session = isolationScope.getSession();
	if (session && client) client.captureSession(session);
}
function captureSession(end = false) {
	if (end) {
		endSession();
		return;
	}
	_sendSessionUpdate();
}
var SENTRY_API_VERSION = "7";
function getBaseApiEndpoint(dsn) {
	const protocol = dsn.protocol ? `${dsn.protocol}:` : "";
	const port = dsn.port ? `:${dsn.port}` : "";
	return `${protocol}//${dsn.host}${port}${dsn.path ? `/${dsn.path}` : ""}/api/`;
}
function _getIngestEndpoint(dsn) {
	return `${getBaseApiEndpoint(dsn)}${dsn.projectId}/envelope/`;
}
function _encodedAuth(dsn, sdkInfo) {
	const params = { sentry_version: SENTRY_API_VERSION };
	if (dsn.publicKey) params.sentry_key = dsn.publicKey;
	if (sdkInfo) params.sentry_client = `${sdkInfo.name}/${sdkInfo.version}`;
	return new URLSearchParams(params).toString();
}
function getEnvelopeEndpointWithUrlEncodedAuth(dsn, tunnel, sdkInfo) {
	return tunnel ? tunnel : `${_getIngestEndpoint(dsn)}?${_encodedAuth(dsn, sdkInfo)}`;
}
function getReportDialogEndpoint(dsnLike, dialogOptions) {
	const dsn = makeDsn(dsnLike);
	if (!dsn) return "";
	const endpoint = `${getBaseApiEndpoint(dsn)}embed/error-page/`;
	let encodedOptions = `dsn=${dsnToString(dsn)}`;
	for (const key in dialogOptions) {
		if (key === "dsn") continue;
		if (key === "onClose") continue;
		if (key === "user") {
			const user = dialogOptions.user;
			if (!user) continue;
			if (user.name) encodedOptions += `&name=${encodeURIComponent(user.name)}`;
			if (user.email) encodedOptions += `&email=${encodeURIComponent(user.email)}`;
		} else encodedOptions += `&${encodeURIComponent(key)}=${encodeURIComponent(dialogOptions[key])}`;
	}
	return `${endpoint}?${encodedOptions}`;
}
var installedIntegrations = [];
function filterDuplicates(integrations) {
	const integrationsByName = {};
	integrations.forEach((currentInstance) => {
		const { name } = currentInstance;
		const existingInstance = integrationsByName[name];
		if (existingInstance && !existingInstance.isDefaultInstance && currentInstance.isDefaultInstance) return;
		integrationsByName[name] = currentInstance;
	});
	return Object.values(integrationsByName);
}
function getIntegrationsToSetup(options) {
	const defaultIntegrations = options.defaultIntegrations || [];
	const userIntegrations = options.integrations;
	defaultIntegrations.forEach((integration) => {
		integration.isDefaultInstance = true;
	});
	let integrations;
	if (Array.isArray(userIntegrations)) integrations = [...defaultIntegrations, ...userIntegrations];
	else if (typeof userIntegrations === "function") {
		const resolvedUserIntegrations = userIntegrations(defaultIntegrations);
		integrations = Array.isArray(resolvedUserIntegrations) ? resolvedUserIntegrations : [resolvedUserIntegrations];
	} else integrations = defaultIntegrations;
	return filterDuplicates(integrations);
}
function setupIntegrations(client, integrations) {
	const integrationIndex = {};
	integrations.forEach((integration) => {
		if (integration) setupIntegration(client, integration, integrationIndex);
	});
	return integrationIndex;
}
function afterSetupIntegrations(client, integrations) {
	for (const integration of integrations) if (integration?.afterAllSetup) integration.afterAllSetup(client);
}
function setupIntegration(client, integration, integrationIndex) {
	if (integrationIndex[integration.name]) {
		DEBUG_BUILD$3 && debug.log(`Integration skipped because it was already installed: ${integration.name}`);
		return;
	}
	integrationIndex[integration.name] = integration;
	if (installedIntegrations.indexOf(integration.name) === -1 && typeof integration.setupOnce === "function") {
		integration.setupOnce();
		installedIntegrations.push(integration.name);
	}
	if (integration.setup && typeof integration.setup === "function") integration.setup(client);
	if (typeof integration.preprocessEvent === "function") {
		const callback = integration.preprocessEvent.bind(integration);
		client.on("preprocessEvent", (event, hint) => callback(event, hint, client));
	}
	if (typeof integration.processEvent === "function") {
		const callback = integration.processEvent.bind(integration);
		const processor = Object.assign((event, hint) => callback(event, hint, client), { id: integration.name });
		client.addEventProcessor(processor);
	}
	DEBUG_BUILD$3 && debug.log(`Integration installed: ${integration.name}`);
}
function defineIntegration(fn) {
	return fn;
}
function createClientReportEnvelope(discarded_events, dsn, timestamp) {
	const clientReportItem = [{ type: "client_report" }, {
		timestamp: timestamp || dateTimestampInSeconds(),
		discarded_events
	}];
	return createEnvelope(dsn ? { dsn } : {}, [clientReportItem]);
}
function getPossibleEventMessages(event) {
	const possibleMessages = [];
	if (event.message) possibleMessages.push(event.message);
	try {
		const lastException = event.exception.values[event.exception.values.length - 1];
		if (lastException?.value) {
			possibleMessages.push(lastException.value);
			if (lastException.type) possibleMessages.push(`${lastException.type}: ${lastException.value}`);
		}
	} catch {}
	return possibleMessages;
}
function convertTransactionEventToSpanJson(event) {
	const { trace_id, parent_span_id, span_id, status, origin, data, op } = event.contexts?.trace ?? {};
	return {
		data: data ?? {},
		description: event.transaction,
		op,
		parent_span_id,
		span_id: span_id ?? "",
		start_timestamp: event.start_timestamp ?? 0,
		status,
		timestamp: event.timestamp,
		trace_id: trace_id ?? "",
		origin,
		profile_id: data?.[SEMANTIC_ATTRIBUTE_PROFILE_ID],
		exclusive_time: data?.[SEMANTIC_ATTRIBUTE_EXCLUSIVE_TIME],
		measurements: event.measurements,
		is_segment: true
	};
}
function convertSpanJsonToTransactionEvent(span) {
	return {
		type: "transaction",
		timestamp: span.timestamp,
		start_timestamp: span.start_timestamp,
		transaction: span.description,
		contexts: { trace: {
			trace_id: span.trace_id,
			span_id: span.span_id,
			parent_span_id: span.parent_span_id,
			op: span.op,
			status: span.status,
			origin: span.origin,
			data: {
				...span.data,
				...span.profile_id && { ["sentry.profile_id"]: span.profile_id },
				...span.exclusive_time && { ["sentry.exclusive_time"]: span.exclusive_time }
			}
		} },
		measurements: span.measurements
	};
}
var ALREADY_SEEN_ERROR = "Not capturing exception because it's already been captured.";
var MISSING_RELEASE_FOR_SESSION_ERROR = "Discarded session because of missing or non-string release";
var INTERNAL_ERROR_SYMBOL = Symbol.for("SentryInternalError");
var DO_NOT_SEND_EVENT_SYMBOL = Symbol.for("SentryDoNotSendEventError");
function _makeInternalError(message) {
	return {
		message,
		[INTERNAL_ERROR_SYMBOL]: true
	};
}
function _makeDoNotSendEventError(message) {
	return {
		message,
		[DO_NOT_SEND_EVENT_SYMBOL]: true
	};
}
function _isInternalError(error$1) {
	return !!error$1 && typeof error$1 === "object" && INTERNAL_ERROR_SYMBOL in error$1;
}
function _isDoNotSendEventError(error$1) {
	return !!error$1 && typeof error$1 === "object" && DO_NOT_SEND_EVENT_SYMBOL in error$1;
}
var Client = class {
	constructor(options) {
		this._options = options;
		this._integrations = {};
		this._numProcessing = 0;
		this._outcomes = {};
		this._hooks = {};
		this._eventProcessors = [];
		if (options.dsn) this._dsn = makeDsn(options.dsn);
		else DEBUG_BUILD$3 && debug.warn("No DSN provided, client will not send events.");
		if (this._dsn) {
			const url = getEnvelopeEndpointWithUrlEncodedAuth(this._dsn, options.tunnel, options._metadata ? options._metadata.sdk : void 0);
			this._transport = options.transport({
				tunnel: this._options.tunnel,
				recordDroppedEvent: this.recordDroppedEvent.bind(this),
				...options.transportOptions,
				url
			});
		}
	}
	captureException(exception, hint, scope) {
		const eventId = uuid4();
		if (checkOrSetAlreadyCaught(exception)) {
			DEBUG_BUILD$3 && debug.log(ALREADY_SEEN_ERROR);
			return eventId;
		}
		const hintWithEventId = {
			event_id: eventId,
			...hint
		};
		this._process(this.eventFromException(exception, hintWithEventId).then((event) => this._captureEvent(event, hintWithEventId, scope)));
		return hintWithEventId.event_id;
	}
	captureMessage(message, level, hint, currentScope) {
		const hintWithEventId = {
			event_id: uuid4(),
			...hint
		};
		const eventMessage = isParameterizedString(message) ? message : String(message);
		const promisedEvent = isPrimitive(message) ? this.eventFromMessage(eventMessage, level, hintWithEventId) : this.eventFromException(message, hintWithEventId);
		this._process(promisedEvent.then((event) => this._captureEvent(event, hintWithEventId, currentScope)));
		return hintWithEventId.event_id;
	}
	captureEvent(event, hint, currentScope) {
		const eventId = uuid4();
		if (hint?.originalException && checkOrSetAlreadyCaught(hint.originalException)) {
			DEBUG_BUILD$3 && debug.log(ALREADY_SEEN_ERROR);
			return eventId;
		}
		const hintWithEventId = {
			event_id: eventId,
			...hint
		};
		const sdkProcessingMetadata = event.sdkProcessingMetadata || {};
		const capturedSpanScope = sdkProcessingMetadata.capturedSpanScope;
		const capturedSpanIsolationScope = sdkProcessingMetadata.capturedSpanIsolationScope;
		this._process(this._captureEvent(event, hintWithEventId, capturedSpanScope || currentScope, capturedSpanIsolationScope));
		return hintWithEventId.event_id;
	}
	captureSession(session) {
		this.sendSession(session);
		updateSession(session, { init: false });
	}
	getDsn() {
		return this._dsn;
	}
	getOptions() {
		return this._options;
	}
	getSdkMetadata() {
		return this._options._metadata;
	}
	getTransport() {
		return this._transport;
	}
	flush(timeout) {
		const transport = this._transport;
		if (transport) {
			this.emit("flush");
			return this._isClientDoneProcessing(timeout).then((clientFinished) => {
				return transport.flush(timeout).then((transportFlushed) => clientFinished && transportFlushed);
			});
		} else return resolvedSyncPromise(true);
	}
	close(timeout) {
		return this.flush(timeout).then((result) => {
			this.getOptions().enabled = false;
			this.emit("close");
			return result;
		});
	}
	getEventProcessors() {
		return this._eventProcessors;
	}
	addEventProcessor(eventProcessor) {
		this._eventProcessors.push(eventProcessor);
	}
	init() {
		if (this._isEnabled() || this._options.integrations.some(({ name }) => name.startsWith("Spotlight"))) this._setupIntegrations();
	}
	getIntegrationByName(integrationName) {
		return this._integrations[integrationName];
	}
	addIntegration(integration) {
		const isAlreadyInstalled = this._integrations[integration.name];
		setupIntegration(this, integration, this._integrations);
		if (!isAlreadyInstalled) afterSetupIntegrations(this, [integration]);
	}
	sendEvent(event, hint = {}) {
		this.emit("beforeSendEvent", event, hint);
		let env = createEventEnvelope(event, this._dsn, this._options._metadata, this._options.tunnel);
		for (const attachment of hint.attachments || []) env = addItemToEnvelope(env, createAttachmentEnvelopeItem(attachment));
		const promise = this.sendEnvelope(env);
		if (promise) promise.then((sendResponse) => this.emit("afterSendEvent", event, sendResponse), null);
	}
	sendSession(session) {
		const { release: clientReleaseOption, environment: clientEnvironmentOption = DEFAULT_ENVIRONMENT } = this._options;
		if ("aggregates" in session) {
			const sessionAttrs = session.attrs || {};
			if (!sessionAttrs.release && !clientReleaseOption) {
				DEBUG_BUILD$3 && debug.warn(MISSING_RELEASE_FOR_SESSION_ERROR);
				return;
			}
			sessionAttrs.release = sessionAttrs.release || clientReleaseOption;
			sessionAttrs.environment = sessionAttrs.environment || clientEnvironmentOption;
			session.attrs = sessionAttrs;
		} else {
			if (!session.release && !clientReleaseOption) {
				DEBUG_BUILD$3 && debug.warn(MISSING_RELEASE_FOR_SESSION_ERROR);
				return;
			}
			session.release = session.release || clientReleaseOption;
			session.environment = session.environment || clientEnvironmentOption;
		}
		this.emit("beforeSendSession", session);
		const env = createSessionEnvelope(session, this._dsn, this._options._metadata, this._options.tunnel);
		this.sendEnvelope(env);
	}
	recordDroppedEvent(reason, category, count$1 = 1) {
		if (this._options.sendClientReports) {
			const key = `${reason}:${category}`;
			DEBUG_BUILD$3 && debug.log(`Recording outcome: "${key}"${count$1 > 1 ? ` (${count$1} times)` : ""}`);
			this._outcomes[key] = (this._outcomes[key] || 0) + count$1;
		}
	}
	on(hook, callback) {
		const hooks = this._hooks[hook] = this._hooks[hook] || [];
		hooks.push(callback);
		return () => {
			const cbIndex = hooks.indexOf(callback);
			if (cbIndex > -1) hooks.splice(cbIndex, 1);
		};
	}
	emit(hook, ...rest) {
		const callbacks = this._hooks[hook];
		if (callbacks) callbacks.forEach((callback) => callback(...rest));
	}
	sendEnvelope(envelope) {
		this.emit("beforeEnvelope", envelope);
		if (this._isEnabled() && this._transport) return this._transport.send(envelope).then(null, (reason) => {
			DEBUG_BUILD$3 && debug.error("Error while sending envelope:", reason);
			return reason;
		});
		DEBUG_BUILD$3 && debug.error("Transport disabled");
		return resolvedSyncPromise({});
	}
	_setupIntegrations() {
		const { integrations } = this._options;
		this._integrations = setupIntegrations(this, integrations);
		afterSetupIntegrations(this, integrations);
	}
	_updateSessionFromEvent(session, event) {
		let crashed = event.level === "fatal";
		let errored = false;
		const exceptions = event.exception?.values;
		if (exceptions) {
			errored = true;
			for (const ex of exceptions) if (ex.mechanism?.handled === false) {
				crashed = true;
				break;
			}
		}
		const sessionNonTerminal = session.status === "ok";
		if (sessionNonTerminal && session.errors === 0 || sessionNonTerminal && crashed) {
			updateSession(session, {
				...crashed && { status: "crashed" },
				errors: session.errors || Number(errored || crashed)
			});
			this.captureSession(session);
		}
	}
	_isClientDoneProcessing(timeout) {
		return new SyncPromise((resolve) => {
			let ticked = 0;
			const tick = 1;
			const interval = setInterval(() => {
				if (this._numProcessing == 0) {
					clearInterval(interval);
					resolve(true);
				} else {
					ticked += tick;
					if (timeout && ticked >= timeout) {
						clearInterval(interval);
						resolve(false);
					}
				}
			}, tick);
		});
	}
	_isEnabled() {
		return this.getOptions().enabled !== false && this._transport !== void 0;
	}
	_prepareEvent(event, hint, currentScope, isolationScope) {
		const options = this.getOptions();
		const integrations = Object.keys(this._integrations);
		if (!hint.integrations && integrations?.length) hint.integrations = integrations;
		this.emit("preprocessEvent", event, hint);
		if (!event.type) isolationScope.setLastEventId(event.event_id || hint.event_id);
		return prepareEvent(options, event, hint, currentScope, this, isolationScope).then((evt) => {
			if (evt === null) return evt;
			this.emit("postprocessEvent", evt, hint);
			evt.contexts = {
				trace: getTraceContextFromScope(currentScope),
				...evt.contexts
			};
			evt.sdkProcessingMetadata = {
				dynamicSamplingContext: getDynamicSamplingContextFromScope(this, currentScope),
				...evt.sdkProcessingMetadata
			};
			return evt;
		});
	}
	_captureEvent(event, hint = {}, currentScope = getCurrentScope(), isolationScope = getIsolationScope()) {
		if (DEBUG_BUILD$3 && isErrorEvent$1(event)) debug.log(`Captured error event \`${getPossibleEventMessages(event)[0] || "<unknown>"}\``);
		return this._processEvent(event, hint, currentScope, isolationScope).then((finalEvent) => {
			return finalEvent.event_id;
		}, (reason) => {
			if (DEBUG_BUILD$3) if (_isDoNotSendEventError(reason)) debug.log(reason.message);
			else if (_isInternalError(reason)) debug.warn(reason.message);
			else debug.warn(reason);
		});
	}
	_processEvent(event, hint, currentScope, isolationScope) {
		const options = this.getOptions();
		const { sampleRate } = options;
		const isTransaction = isTransactionEvent(event);
		const isError$1 = isErrorEvent$1(event);
		const eventType = event.type || "error";
		const beforeSendLabel = `before send for type \`${eventType}\``;
		const parsedSampleRate = typeof sampleRate === "undefined" ? void 0 : parseSampleRate(sampleRate);
		if (isError$1 && typeof parsedSampleRate === "number" && Math.random() > parsedSampleRate) {
			this.recordDroppedEvent("sample_rate", "error");
			return rejectedSyncPromise(_makeDoNotSendEventError(`Discarding event because it's not included in the random sample (sampling rate = ${sampleRate})`));
		}
		const dataCategory = eventType === "replay_event" ? "replay" : eventType;
		return this._prepareEvent(event, hint, currentScope, isolationScope).then((prepared) => {
			if (prepared === null) {
				this.recordDroppedEvent("event_processor", dataCategory);
				throw _makeDoNotSendEventError("An event processor returned `null`, will not send event.");
			}
			if (hint.data && hint.data.__sentry__ === true) return prepared;
			return _validateBeforeSendResult(processBeforeSend(this, options, prepared, hint), beforeSendLabel);
		}).then((processedEvent) => {
			if (processedEvent === null) {
				this.recordDroppedEvent("before_send", dataCategory);
				if (isTransaction) {
					const spanCount = 1 + (event.spans || []).length;
					this.recordDroppedEvent("before_send", "span", spanCount);
				}
				throw _makeDoNotSendEventError(`${beforeSendLabel} returned \`null\`, will not send event.`);
			}
			const session = currentScope.getSession() || isolationScope.getSession();
			if (isError$1 && session) this._updateSessionFromEvent(session, processedEvent);
			if (isTransaction) {
				const droppedSpanCount = (processedEvent.sdkProcessingMetadata?.spanCountBeforeProcessing || 0) - (processedEvent.spans ? processedEvent.spans.length : 0);
				if (droppedSpanCount > 0) this.recordDroppedEvent("before_send", "span", droppedSpanCount);
			}
			const transactionInfo = processedEvent.transaction_info;
			if (isTransaction && transactionInfo && processedEvent.transaction !== event.transaction) {
				const source = "custom";
				processedEvent.transaction_info = {
					...transactionInfo,
					source
				};
			}
			this.sendEvent(processedEvent, hint);
			return processedEvent;
		}).then(null, (reason) => {
			if (_isDoNotSendEventError(reason) || _isInternalError(reason)) throw reason;
			this.captureException(reason, {
				data: { __sentry__: true },
				originalException: reason
			});
			throw _makeInternalError(`Event processing pipeline threw an error, original event will not be sent. Details have been sent as a new event.\nReason: ${reason}`);
		});
	}
	_process(promise) {
		this._numProcessing++;
		promise.then((value) => {
			this._numProcessing--;
			return value;
		}, (reason) => {
			this._numProcessing--;
			return reason;
		});
	}
	_clearOutcomes() {
		const outcomes = this._outcomes;
		this._outcomes = {};
		return Object.entries(outcomes).map(([key, quantity]) => {
			const [reason, category] = key.split(":");
			return {
				reason,
				category,
				quantity
			};
		});
	}
	_flushOutcomes() {
		DEBUG_BUILD$3 && debug.log("Flushing outcomes...");
		const outcomes = this._clearOutcomes();
		if (outcomes.length === 0) {
			DEBUG_BUILD$3 && debug.log("No outcomes to send");
			return;
		}
		if (!this._dsn) {
			DEBUG_BUILD$3 && debug.log("No dsn provided, will not send outcomes");
			return;
		}
		DEBUG_BUILD$3 && debug.log("Sending outcomes:", outcomes);
		const envelope = createClientReportEnvelope(outcomes, this._options.tunnel && dsnToString(this._dsn));
		this.sendEnvelope(envelope);
	}
};
function _validateBeforeSendResult(beforeSendResult, beforeSendLabel) {
	const invalidValueError = `${beforeSendLabel} must return \`null\` or a valid event.`;
	if (isThenable(beforeSendResult)) return beforeSendResult.then((event) => {
		if (!isPlainObject(event) && event !== null) throw _makeInternalError(invalidValueError);
		return event;
	}, (e) => {
		throw _makeInternalError(`${beforeSendLabel} rejected with ${e}`);
	});
	else if (!isPlainObject(beforeSendResult) && beforeSendResult !== null) throw _makeInternalError(invalidValueError);
	return beforeSendResult;
}
function processBeforeSend(client, options, event, hint) {
	const { beforeSend, beforeSendTransaction, beforeSendSpan } = options;
	let processedEvent = event;
	if (isErrorEvent$1(processedEvent) && beforeSend) return beforeSend(processedEvent, hint);
	if (isTransactionEvent(processedEvent)) {
		if (beforeSendSpan) {
			const processedRootSpanJson = beforeSendSpan(convertTransactionEventToSpanJson(processedEvent));
			if (!processedRootSpanJson) showSpanDropWarning();
			else processedEvent = merge(event, convertSpanJsonToTransactionEvent(processedRootSpanJson));
			if (processedEvent.spans) {
				const processedSpans = [];
				for (const span of processedEvent.spans) {
					const processedSpan = beforeSendSpan(span);
					if (!processedSpan) {
						showSpanDropWarning();
						processedSpans.push(span);
					} else processedSpans.push(processedSpan);
				}
				processedEvent.spans = processedSpans;
			}
		}
		if (beforeSendTransaction) {
			if (processedEvent.spans) {
				const spanCountBefore = processedEvent.spans.length;
				processedEvent.sdkProcessingMetadata = {
					...event.sdkProcessingMetadata,
					spanCountBeforeProcessing: spanCountBefore
				};
			}
			return beforeSendTransaction(processedEvent, hint);
		}
	}
	return processedEvent;
}
function isErrorEvent$1(event) {
	return event.type === void 0;
}
function isTransactionEvent(event) {
	return event.type === "transaction";
}
function createLogContainerEnvelopeItem(items) {
	return [{
		type: "log",
		item_count: items.length,
		content_type: "application/vnd.sentry.items.log+json"
	}, { items }];
}
function createLogEnvelope(logs, metadata, tunnel, dsn) {
	const headers = {};
	if (metadata?.sdk) headers.sdk = {
		name: metadata.sdk.name,
		version: metadata.sdk.version
	};
	if (!!tunnel && !!dsn) headers.dsn = dsnToString(dsn);
	return createEnvelope(headers, [createLogContainerEnvelopeItem(logs)]);
}
function _INTERNAL_flushLogsBuffer(client, maybeLogBuffer) {
	const logBuffer = maybeLogBuffer ?? _INTERNAL_getLogBuffer(client) ?? [];
	if (logBuffer.length === 0) return;
	const clientOptions = client.getOptions();
	const envelope = createLogEnvelope(logBuffer, clientOptions._metadata, clientOptions.tunnel, client.getDsn());
	_getBufferMap().set(client, []);
	client.emit("flushLogs");
	client.sendEnvelope(envelope);
}
function _INTERNAL_getLogBuffer(client) {
	return _getBufferMap().get(client);
}
function _getBufferMap() {
	return getGlobalSingleton("clientToLogBufferMap", () => /* @__PURE__ */ new WeakMap());
}
function initAndBind(clientClass, options) {
	if (options.debug === true) if (DEBUG_BUILD$3) debug.enable();
	else consoleSandbox(() => {
		console.warn("[Sentry] Cannot initialize SDK with `debug` option using a non-debug bundle.");
	});
	getCurrentScope().update(options.initialScope);
	const client = new clientClass(options);
	setCurrentClient(client);
	client.init();
	return client;
}
function setCurrentClient(client) {
	getCurrentScope().setClient(client);
}
var SENTRY_BUFFER_FULL_ERROR = Symbol.for("SentryBufferFullError");
function makePromiseBuffer(limit) {
	const buffer = [];
	function isReady() {
		return limit === void 0 || buffer.length < limit;
	}
	function remove(task) {
		return buffer.splice(buffer.indexOf(task), 1)[0] || Promise.resolve(void 0);
	}
	function add(taskProducer) {
		if (!isReady()) return rejectedSyncPromise(SENTRY_BUFFER_FULL_ERROR);
		const task = taskProducer();
		if (buffer.indexOf(task) === -1) buffer.push(task);
		task.then(() => remove(task)).then(null, () => remove(task).then(null, () => {}));
		return task;
	}
	function drain(timeout) {
		return new SyncPromise((resolve, reject) => {
			let counter = buffer.length;
			if (!counter) return resolve(true);
			const capturedSetTimeout = setTimeout(() => {
				if (timeout && timeout > 0) resolve(false);
			}, timeout);
			buffer.forEach((item) => {
				resolvedSyncPromise(item).then(() => {
					if (!--counter) {
						clearTimeout(capturedSetTimeout);
						resolve(true);
					}
				}, reject);
			});
		});
	}
	return {
		$: buffer,
		add,
		drain
	};
}
var DEFAULT_RETRY_AFTER = 60 * 1e3;
function parseRetryAfterHeader(header, now = Date.now()) {
	const headerDelay = parseInt(`${header}`, 10);
	if (!isNaN(headerDelay)) return headerDelay * 1e3;
	const headerDate = Date.parse(`${header}`);
	if (!isNaN(headerDate)) return headerDate - now;
	return DEFAULT_RETRY_AFTER;
}
function disabledUntil(limits, dataCategory) {
	return limits[dataCategory] || limits.all || 0;
}
function isRateLimited(limits, dataCategory, now = Date.now()) {
	return disabledUntil(limits, dataCategory) > now;
}
function updateRateLimits(limits, { statusCode, headers }, now = Date.now()) {
	const updatedRateLimits = { ...limits };
	const rateLimitHeader = headers?.["x-sentry-rate-limits"];
	const retryAfterHeader = headers?.["retry-after"];
	if (rateLimitHeader) for (const limit of rateLimitHeader.trim().split(",")) {
		const [retryAfter, categories, , , namespaces] = limit.split(":", 5);
		const headerDelay = parseInt(retryAfter, 10);
		const delay = (!isNaN(headerDelay) ? headerDelay : 60) * 1e3;
		if (!categories) updatedRateLimits.all = now + delay;
		else for (const category of categories.split(";")) if (category === "metric_bucket") {
			if (!namespaces || namespaces.split(";").includes("custom")) updatedRateLimits[category] = now + delay;
		} else updatedRateLimits[category] = now + delay;
	}
	else if (retryAfterHeader) updatedRateLimits.all = now + parseRetryAfterHeader(retryAfterHeader, now);
	else if (statusCode === 429) updatedRateLimits.all = now + 60 * 1e3;
	return updatedRateLimits;
}
function createTransport(options, makeRequest, buffer = makePromiseBuffer(options.bufferSize || 64)) {
	let rateLimits = {};
	const flush = (timeout) => buffer.drain(timeout);
	function send(envelope) {
		const filteredEnvelopeItems = [];
		forEachEnvelopeItem(envelope, (item, type) => {
			const dataCategory = envelopeItemTypeToDataCategory(type);
			if (isRateLimited(rateLimits, dataCategory)) options.recordDroppedEvent("ratelimit_backoff", dataCategory);
			else filteredEnvelopeItems.push(item);
		});
		if (filteredEnvelopeItems.length === 0) return resolvedSyncPromise({});
		const filteredEnvelope = createEnvelope(envelope[0], filteredEnvelopeItems);
		const recordEnvelopeLoss = (reason) => {
			forEachEnvelopeItem(filteredEnvelope, (item, type) => {
				options.recordDroppedEvent(reason, envelopeItemTypeToDataCategory(type));
			});
		};
		const requestTask = () => makeRequest({ body: serializeEnvelope(filteredEnvelope) }).then((response) => {
			if (response.statusCode !== void 0 && (response.statusCode < 200 || response.statusCode >= 300)) DEBUG_BUILD$3 && debug.warn(`Sentry responded with status code ${response.statusCode} to sent event.`);
			rateLimits = updateRateLimits(rateLimits, response);
			return response;
		}, (error$1) => {
			recordEnvelopeLoss("network_error");
			DEBUG_BUILD$3 && debug.error("Encountered error running transport request:", error$1);
			throw error$1;
		});
		return buffer.add(requestTask).then((result) => result, (error$1) => {
			if (error$1 === SENTRY_BUFFER_FULL_ERROR) {
				DEBUG_BUILD$3 && debug.error("Skipped sending event because buffer is full.");
				recordEnvelopeLoss("queue_overflow");
				return resolvedSyncPromise({});
			} else throw error$1;
		});
	}
	return {
		send,
		flush
	};
}
function addAutoIpAddressToUser(objWithMaybeUser) {
	if (objWithMaybeUser.user?.ip_address === void 0) objWithMaybeUser.user = {
		...objWithMaybeUser.user,
		ip_address: "{{auto}}"
	};
}
function addAutoIpAddressToSession(session) {
	if ("aggregates" in session) {
		if (session.attrs?.["ip_address"] === void 0) session.attrs = {
			...session.attrs,
			ip_address: "{{auto}}"
		};
	} else if (session.ipAddress === void 0) session.ipAddress = "{{auto}}";
}
function applySdkMetadata(options, name, names = [name], source = "npm") {
	const metadata = options._metadata || {};
	if (!metadata.sdk) metadata.sdk = {
		name: `sentry.javascript.${name}`,
		packages: names.map((name$1) => ({
			name: `${source}:@sentry/${name$1}`,
			version: SDK_VERSION
		})),
		version: SDK_VERSION
	};
	options._metadata = metadata;
}
var DEFAULT_BREADCRUMBS = 100;
function addBreadcrumb(breadcrumb, hint) {
	const client = getClient();
	const isolationScope = getIsolationScope();
	if (!client) return;
	const { beforeBreadcrumb = null, maxBreadcrumbs = DEFAULT_BREADCRUMBS } = client.getOptions();
	if (maxBreadcrumbs <= 0) return;
	const mergedBreadcrumb = {
		timestamp: dateTimestampInSeconds(),
		...breadcrumb
	};
	const finalBreadcrumb = beforeBreadcrumb ? consoleSandbox(() => beforeBreadcrumb(mergedBreadcrumb, hint)) : mergedBreadcrumb;
	if (finalBreadcrumb === null) return;
	if (client.emit) client.emit("beforeAddBreadcrumb", finalBreadcrumb, hint);
	isolationScope.addBreadcrumb(finalBreadcrumb, maxBreadcrumbs);
}
var originalFunctionToString;
var INTEGRATION_NAME$6 = "FunctionToString";
var SETUP_CLIENTS = /* @__PURE__ */ new WeakMap();
var _functionToStringIntegration = (() => {
	return {
		name: INTEGRATION_NAME$6,
		setupOnce() {
			originalFunctionToString = Function.prototype.toString;
			try {
				Function.prototype.toString = function(...args) {
					const originalFunction = getOriginalFunction(this);
					const context = SETUP_CLIENTS.has(getClient()) && originalFunction !== void 0 ? originalFunction : this;
					return originalFunctionToString.apply(context, args);
				};
			} catch {}
		},
		setup(client) {
			SETUP_CLIENTS.set(client, true);
		}
	};
});
var functionToStringIntegration = defineIntegration(_functionToStringIntegration);
var DEFAULT_IGNORE_ERRORS = [
	/^Script error\.?$/,
	/^Javascript error: Script error\.? on line 0$/,
	/^ResizeObserver loop completed with undelivered notifications.$/,
	/^Cannot redefine property: googletag$/,
	/^Can't find variable: gmo$/,
	/^undefined is not an object \(evaluating 'a\.[A-Z]'\)$/,
	"can't redefine non-configurable property \"solana\"",
	"vv().getRestrictions is not a function. (In 'vv().getRestrictions(1,a)', 'vv().getRestrictions' is undefined)",
	"Can't find variable: _AutofillCallbackHandler",
	/^Non-Error promise rejection captured with value: Object Not Found Matching Id:\d+, MethodName:simulateEvent, ParamCount:\d+$/,
	/^Java exception was raised during method invocation$/
];
var INTEGRATION_NAME$5 = "EventFilters";
var eventFiltersIntegration = defineIntegration((options = {}) => {
	let mergedOptions;
	return {
		name: INTEGRATION_NAME$5,
		setup(client) {
			mergedOptions = _mergeOptions(options, client.getOptions());
		},
		processEvent(event, _hint, client) {
			if (!mergedOptions) mergedOptions = _mergeOptions(options, client.getOptions());
			return _shouldDropEvent$1(event, mergedOptions) ? null : event;
		}
	};
});
var inboundFiltersIntegration = defineIntegration(((options = {}) => {
	return {
		...eventFiltersIntegration(options),
		name: "InboundFilters"
	};
}));
function _mergeOptions(internalOptions = {}, clientOptions = {}) {
	return {
		allowUrls: [...internalOptions.allowUrls || [], ...clientOptions.allowUrls || []],
		denyUrls: [...internalOptions.denyUrls || [], ...clientOptions.denyUrls || []],
		ignoreErrors: [
			...internalOptions.ignoreErrors || [],
			...clientOptions.ignoreErrors || [],
			...internalOptions.disableErrorDefaults ? [] : DEFAULT_IGNORE_ERRORS
		],
		ignoreTransactions: [...internalOptions.ignoreTransactions || [], ...clientOptions.ignoreTransactions || []]
	};
}
function _shouldDropEvent$1(event, options) {
	if (!event.type) {
		if (_isIgnoredError(event, options.ignoreErrors)) {
			DEBUG_BUILD$3 && debug.warn(`Event dropped due to being matched by \`ignoreErrors\` option.\nEvent: ${getEventDescription(event)}`);
			return true;
		}
		if (_isUselessError(event)) {
			DEBUG_BUILD$3 && debug.warn(`Event dropped due to not having an error message, error type or stacktrace.\nEvent: ${getEventDescription(event)}`);
			return true;
		}
		if (_isDeniedUrl(event, options.denyUrls)) {
			DEBUG_BUILD$3 && debug.warn(`Event dropped due to being matched by \`denyUrls\` option.\nEvent: ${getEventDescription(event)}.\nUrl: ${_getEventFilterUrl(event)}`);
			return true;
		}
		if (!_isAllowedUrl(event, options.allowUrls)) {
			DEBUG_BUILD$3 && debug.warn(`Event dropped due to not being matched by \`allowUrls\` option.\nEvent: ${getEventDescription(event)}.\nUrl: ${_getEventFilterUrl(event)}`);
			return true;
		}
	} else if (event.type === "transaction") {
		if (_isIgnoredTransaction(event, options.ignoreTransactions)) {
			DEBUG_BUILD$3 && debug.warn(`Event dropped due to being matched by \`ignoreTransactions\` option.\nEvent: ${getEventDescription(event)}`);
			return true;
		}
	}
	return false;
}
function _isIgnoredError(event, ignoreErrors) {
	if (!ignoreErrors?.length) return false;
	return getPossibleEventMessages(event).some((message) => stringMatchesSomePattern(message, ignoreErrors));
}
function _isIgnoredTransaction(event, ignoreTransactions) {
	if (!ignoreTransactions?.length) return false;
	const name = event.transaction;
	return name ? stringMatchesSomePattern(name, ignoreTransactions) : false;
}
function _isDeniedUrl(event, denyUrls) {
	if (!denyUrls?.length) return false;
	const url = _getEventFilterUrl(event);
	return !url ? false : stringMatchesSomePattern(url, denyUrls);
}
function _isAllowedUrl(event, allowUrls) {
	if (!allowUrls?.length) return true;
	const url = _getEventFilterUrl(event);
	return !url ? true : stringMatchesSomePattern(url, allowUrls);
}
function _getLastValidUrl(frames = []) {
	for (let i = frames.length - 1; i >= 0; i--) {
		const frame = frames[i];
		if (frame && frame.filename !== "<anonymous>" && frame.filename !== "[native code]") return frame.filename || null;
	}
	return null;
}
function _getEventFilterUrl(event) {
	try {
		const frames = [...event.exception?.values ?? []].reverse().find((value) => value.mechanism?.parent_id === void 0 && value.stacktrace?.frames?.length)?.stacktrace?.frames;
		return frames ? _getLastValidUrl(frames) : null;
	} catch {
		DEBUG_BUILD$3 && debug.error(`Cannot extract url for event ${getEventDescription(event)}`);
		return null;
	}
}
function _isUselessError(event) {
	if (!event.exception?.values?.length) return false;
	return !event.message && !event.exception.values.some((value) => value.stacktrace || value.type && value.type !== "Error" || value.value);
}
function applyAggregateErrorsToEvent(exceptionFromErrorImplementation, parser, key, limit, event, hint) {
	if (!event.exception?.values || !hint || !isInstanceOf(hint.originalException, Error)) return;
	const originalException = event.exception.values.length > 0 ? event.exception.values[event.exception.values.length - 1] : void 0;
	if (originalException) event.exception.values = aggregateExceptionsFromError(exceptionFromErrorImplementation, parser, limit, hint.originalException, key, event.exception.values, originalException, 0);
}
function aggregateExceptionsFromError(exceptionFromErrorImplementation, parser, limit, error$1, key, prevExceptions, exception, exceptionId) {
	if (prevExceptions.length >= limit + 1) return prevExceptions;
	let newExceptions = [...prevExceptions];
	if (isInstanceOf(error$1[key], Error)) {
		applyExceptionGroupFieldsForParentException(exception, exceptionId);
		const newException = exceptionFromErrorImplementation(parser, error$1[key]);
		const newExceptionId = newExceptions.length;
		applyExceptionGroupFieldsForChildException(newException, key, newExceptionId, exceptionId);
		newExceptions = aggregateExceptionsFromError(exceptionFromErrorImplementation, parser, limit, error$1[key], key, [newException, ...newExceptions], newException, newExceptionId);
	}
	if (Array.isArray(error$1.errors)) error$1.errors.forEach((childError, i) => {
		if (isInstanceOf(childError, Error)) {
			applyExceptionGroupFieldsForParentException(exception, exceptionId);
			const newException = exceptionFromErrorImplementation(parser, childError);
			const newExceptionId = newExceptions.length;
			applyExceptionGroupFieldsForChildException(newException, `errors[${i}]`, newExceptionId, exceptionId);
			newExceptions = aggregateExceptionsFromError(exceptionFromErrorImplementation, parser, limit, childError, key, [newException, ...newExceptions], newException, newExceptionId);
		}
	});
	return newExceptions;
}
function applyExceptionGroupFieldsForParentException(exception, exceptionId) {
	exception.mechanism = exception.mechanism || {
		type: "generic",
		handled: true
	};
	exception.mechanism = {
		...exception.mechanism,
		...exception.type === "AggregateError" && { is_exception_group: true },
		exception_id: exceptionId
	};
}
function applyExceptionGroupFieldsForChildException(exception, source, exceptionId, parentId) {
	exception.mechanism = exception.mechanism || {
		type: "generic",
		handled: true
	};
	exception.mechanism = {
		...exception.mechanism,
		type: "chained",
		source,
		exception_id: exceptionId,
		parent_id: parentId
	};
}
function addConsoleInstrumentationHandler(handler) {
	const type = "console";
	addHandler(type, handler);
	maybeInstrument(type, instrumentConsole);
}
function instrumentConsole() {
	if (!("console" in GLOBAL_OBJ)) return;
	CONSOLE_LEVELS.forEach(function(level) {
		if (!(level in GLOBAL_OBJ.console)) return;
		fill(GLOBAL_OBJ.console, level, function(originalConsoleMethod) {
			originalConsoleMethods[level] = originalConsoleMethod;
			return function(...args) {
				triggerHandlers("console", {
					args,
					level
				});
				originalConsoleMethods[level]?.apply(GLOBAL_OBJ.console, args);
			};
		});
	});
}
function severityLevelFromString(level) {
	return level === "warn" ? "warning" : [
		"fatal",
		"error",
		"warning",
		"log",
		"info",
		"debug"
	].includes(level) ? level : "log";
}
var INTEGRATION_NAME$4 = "Dedupe";
var _dedupeIntegration = (() => {
	let previousEvent;
	return {
		name: INTEGRATION_NAME$4,
		processEvent(currentEvent) {
			if (currentEvent.type) return currentEvent;
			try {
				if (_shouldDropEvent(currentEvent, previousEvent)) {
					DEBUG_BUILD$3 && debug.warn("Event dropped due to being a duplicate of previously captured event.");
					return null;
				}
			} catch {}
			return previousEvent = currentEvent;
		}
	};
});
var dedupeIntegration = defineIntegration(_dedupeIntegration);
function _shouldDropEvent(currentEvent, previousEvent) {
	if (!previousEvent) return false;
	if (_isSameMessageEvent(currentEvent, previousEvent)) return true;
	if (_isSameExceptionEvent(currentEvent, previousEvent)) return true;
	return false;
}
function _isSameMessageEvent(currentEvent, previousEvent) {
	const currentMessage = currentEvent.message;
	const previousMessage = previousEvent.message;
	if (!currentMessage && !previousMessage) return false;
	if (currentMessage && !previousMessage || !currentMessage && previousMessage) return false;
	if (currentMessage !== previousMessage) return false;
	if (!_isSameFingerprint(currentEvent, previousEvent)) return false;
	if (!_isSameStacktrace(currentEvent, previousEvent)) return false;
	return true;
}
function _isSameExceptionEvent(currentEvent, previousEvent) {
	const previousException = _getExceptionFromEvent(previousEvent);
	const currentException = _getExceptionFromEvent(currentEvent);
	if (!previousException || !currentException) return false;
	if (previousException.type !== currentException.type || previousException.value !== currentException.value) return false;
	if (!_isSameFingerprint(currentEvent, previousEvent)) return false;
	if (!_isSameStacktrace(currentEvent, previousEvent)) return false;
	return true;
}
function _isSameStacktrace(currentEvent, previousEvent) {
	let currentFrames = getFramesFromEvent(currentEvent);
	let previousFrames = getFramesFromEvent(previousEvent);
	if (!currentFrames && !previousFrames) return true;
	if (currentFrames && !previousFrames || !currentFrames && previousFrames) return false;
	currentFrames = currentFrames;
	previousFrames = previousFrames;
	if (previousFrames.length !== currentFrames.length) return false;
	for (let i = 0; i < previousFrames.length; i++) {
		const frameA = previousFrames[i];
		const frameB = currentFrames[i];
		if (frameA.filename !== frameB.filename || frameA.lineno !== frameB.lineno || frameA.colno !== frameB.colno || frameA.function !== frameB.function) return false;
	}
	return true;
}
function _isSameFingerprint(currentEvent, previousEvent) {
	let currentFingerprint = currentEvent.fingerprint;
	let previousFingerprint = previousEvent.fingerprint;
	if (!currentFingerprint && !previousFingerprint) return true;
	if (currentFingerprint && !previousFingerprint || !currentFingerprint && previousFingerprint) return false;
	currentFingerprint = currentFingerprint;
	previousFingerprint = previousFingerprint;
	try {
		return !!(currentFingerprint.join("") === previousFingerprint.join(""));
	} catch {
		return false;
	}
}
function _getExceptionFromEvent(event) {
	return event.exception?.values?.[0];
}
function parseUrl(url) {
	if (!url) return {};
	const match = url.match(/^(([^:/?#]+):)?(\/\/([^/?#]*))?([^?#]*)(\?([^#]*))?(#(.*))?$/);
	if (!match) return {};
	const query = match[6] || "";
	const fragment = match[8] || "";
	return {
		host: match[4],
		path: match[5],
		protocol: match[2],
		search: query,
		hash: fragment,
		relative: match[5] + query + fragment
	};
}
function getBreadcrumbLogLevelFromHttpStatusCode(statusCode) {
	if (statusCode === void 0) return;
	else if (statusCode >= 400 && statusCode < 500) return "warning";
	else if (statusCode >= 500) return "error";
	else return;
}
var WINDOW$2 = GLOBAL_OBJ;
function supportsHistory() {
	return "history" in WINDOW$2 && !!WINDOW$2.history;
}
function _isFetchSupported() {
	if (!("fetch" in WINDOW$2)) return false;
	try {
		new Headers();
		new Request("http://www.example.com");
		new Response();
		return true;
	} catch {
		return false;
	}
}
function isNativeFunction(func) {
	return func && /^function\s+\w+\(\)\s+\{\s+\[native code\]\s+\}$/.test(func.toString());
}
function supportsNativeFetch() {
	if (typeof EdgeRuntime === "string") return true;
	if (!_isFetchSupported()) return false;
	if (isNativeFunction(WINDOW$2.fetch)) return true;
	let result = false;
	const doc = WINDOW$2.document;
	if (doc && typeof doc.createElement === "function") try {
		const sandbox = doc.createElement("iframe");
		sandbox.hidden = true;
		doc.head.appendChild(sandbox);
		if (sandbox.contentWindow?.fetch) result = isNativeFunction(sandbox.contentWindow.fetch);
		doc.head.removeChild(sandbox);
	} catch (err) {
		DEBUG_BUILD$3 && debug.warn("Could not create sandbox iframe for pure fetch check, bailing to window.fetch: ", err);
	}
	return result;
}
function addFetchInstrumentationHandler(handler, skipNativeFetchCheck) {
	const type = "fetch";
	addHandler(type, handler);
	maybeInstrument(type, () => instrumentFetch(void 0, skipNativeFetchCheck));
}
function instrumentFetch(onFetchResolved, skipNativeFetchCheck = false) {
	if (skipNativeFetchCheck && !supportsNativeFetch()) return;
	fill(GLOBAL_OBJ, "fetch", function(originalFetch) {
		return function(...args) {
			const virtualError = /* @__PURE__ */ new Error();
			const { method, url } = parseFetchArgs(args);
			const handlerData = {
				args,
				fetchData: {
					method,
					url
				},
				startTimestamp: timestampInSeconds() * 1e3,
				virtualError,
				headers: getHeadersFromFetchArgs(args)
			};
			if (!onFetchResolved) triggerHandlers("fetch", { ...handlerData });
			return originalFetch.apply(GLOBAL_OBJ, args).then(async (response) => {
				if (onFetchResolved) onFetchResolved(response);
				else triggerHandlers("fetch", {
					...handlerData,
					endTimestamp: timestampInSeconds() * 1e3,
					response
				});
				return response;
			}, (error$1) => {
				triggerHandlers("fetch", {
					...handlerData,
					endTimestamp: timestampInSeconds() * 1e3,
					error: error$1
				});
				if (isError(error$1) && error$1.stack === void 0) {
					error$1.stack = virtualError.stack;
					addNonEnumerableProperty(error$1, "framesToPop", 1);
				}
				if (error$1 instanceof TypeError && (error$1.message === "Failed to fetch" || error$1.message === "Load failed" || error$1.message === "NetworkError when attempting to fetch resource.")) try {
					const url$1 = new URL(handlerData.fetchData.url);
					error$1.message = `${error$1.message} (${url$1.host})`;
				} catch {}
				throw error$1;
			});
		};
	});
}
function hasProp(obj, prop) {
	return !!obj && typeof obj === "object" && !!obj[prop];
}
function getUrlFromResource(resource) {
	if (typeof resource === "string") return resource;
	if (!resource) return "";
	if (hasProp(resource, "url")) return resource.url;
	if (resource.toString) return resource.toString();
	return "";
}
function parseFetchArgs(fetchArgs) {
	if (fetchArgs.length === 0) return {
		method: "GET",
		url: ""
	};
	if (fetchArgs.length === 2) {
		const [url, options] = fetchArgs;
		return {
			url: getUrlFromResource(url),
			method: hasProp(options, "method") ? String(options.method).toUpperCase() : "GET"
		};
	}
	const arg = fetchArgs[0];
	return {
		url: getUrlFromResource(arg),
		method: hasProp(arg, "method") ? String(arg.method).toUpperCase() : "GET"
	};
}
function getHeadersFromFetchArgs(fetchArgs) {
	const [requestArgument, optionsArgument] = fetchArgs;
	try {
		if (typeof optionsArgument === "object" && optionsArgument !== null && "headers" in optionsArgument && optionsArgument.headers) return new Headers(optionsArgument.headers);
		if (isRequest(requestArgument)) return new Headers(requestArgument.headers);
	} catch {}
}
function getSDKSource() {
	return "npm";
}
var WINDOW = GLOBAL_OBJ;
var ignoreOnError = 0;
function shouldIgnoreOnError() {
	return ignoreOnError > 0;
}
function ignoreNextOnError() {
	ignoreOnError++;
	setTimeout(() => {
		ignoreOnError--;
	});
}
function wrap(fn, options = {}) {
	function isFunction$1(fn$1) {
		return typeof fn$1 === "function";
	}
	if (!isFunction$1(fn)) return fn;
	try {
		const wrapper = fn.__sentry_wrapped__;
		if (wrapper) if (typeof wrapper === "function") return wrapper;
		else return fn;
		if (getOriginalFunction(fn)) return fn;
	} catch {
		return fn;
	}
	const sentryWrapped = function(...args) {
		try {
			const wrappedArguments = args.map((arg) => wrap(arg, options));
			return fn.apply(this, wrappedArguments);
		} catch (ex) {
			ignoreNextOnError();
			withScope((scope) => {
				scope.addEventProcessor((event) => {
					if (options.mechanism) {
						addExceptionTypeValue(event, void 0, void 0);
						addExceptionMechanism(event, options.mechanism);
					}
					event.extra = {
						...event.extra,
						arguments: args
					};
					return event;
				});
				captureException(ex);
			});
			throw ex;
		}
	};
	try {
		for (const property in fn) if (Object.prototype.hasOwnProperty.call(fn, property)) sentryWrapped[property] = fn[property];
	} catch {}
	markFunctionWrapped(sentryWrapped, fn);
	addNonEnumerableProperty(fn, "__sentry_wrapped__", sentryWrapped);
	try {
		if (Object.getOwnPropertyDescriptor(sentryWrapped, "name").configurable) Object.defineProperty(sentryWrapped, "name", { get() {
			return fn.name;
		} });
	} catch {}
	return sentryWrapped;
}
function getHttpRequestData() {
	const url = getLocationHref();
	const { referrer } = WINDOW.document || {};
	const { userAgent } = WINDOW.navigator || {};
	return {
		url,
		headers: {
			...referrer && { Referer: referrer },
			...userAgent && { "User-Agent": userAgent }
		}
	};
}
function exceptionFromError(stackParser, ex) {
	const frames = parseStackFrames(stackParser, ex);
	const exception = {
		type: extractType(ex),
		value: extractMessage(ex)
	};
	if (frames.length) exception.stacktrace = { frames };
	if (exception.type === void 0 && exception.value === "") exception.value = "Unrecoverable error caught";
	return exception;
}
function eventFromPlainObject(stackParser, exception, syntheticException, isUnhandledRejection) {
	const normalizeDepth = getClient()?.getOptions().normalizeDepth;
	const errorFromProp = getErrorPropertyFromObject(exception);
	const extra = { __serialized__: normalizeToSize(exception, normalizeDepth) };
	if (errorFromProp) return {
		exception: { values: [exceptionFromError(stackParser, errorFromProp)] },
		extra
	};
	const event = {
		exception: { values: [{
			type: isEvent(exception) ? exception.constructor.name : isUnhandledRejection ? "UnhandledRejection" : "Error",
			value: getNonErrorObjectExceptionValue(exception, { isUnhandledRejection })
		}] },
		extra
	};
	if (syntheticException) {
		const frames = parseStackFrames(stackParser, syntheticException);
		if (frames.length) event.exception.values[0].stacktrace = { frames };
	}
	return event;
}
function eventFromError(stackParser, ex) {
	return { exception: { values: [exceptionFromError(stackParser, ex)] } };
}
function parseStackFrames(stackParser, ex) {
	const stacktrace = ex.stacktrace || ex.stack || "";
	const skipLines = getSkipFirstStackStringLines(ex);
	const framesToPop = getPopFirstTopFrames(ex);
	try {
		return stackParser(stacktrace, skipLines, framesToPop);
	} catch {}
	return [];
}
var reactMinifiedRegexp = /Minified React error #\d+;/i;
function getSkipFirstStackStringLines(ex) {
	if (ex && reactMinifiedRegexp.test(ex.message)) return 1;
	return 0;
}
function getPopFirstTopFrames(ex) {
	if (typeof ex.framesToPop === "number") return ex.framesToPop;
	return 0;
}
function isWebAssemblyException(exception) {
	if (typeof WebAssembly !== "undefined" && typeof WebAssembly.Exception !== "undefined") return exception instanceof WebAssembly.Exception;
	else return false;
}
function extractType(ex) {
	const name = ex?.name;
	if (!name && isWebAssemblyException(ex)) return ex.message && Array.isArray(ex.message) && ex.message.length == 2 ? ex.message[0] : "WebAssembly.Exception";
	return name;
}
function extractMessage(ex) {
	const message = ex?.message;
	if (isWebAssemblyException(ex)) {
		if (Array.isArray(ex.message) && ex.message.length == 2) return ex.message[1];
		return "wasm exception";
	}
	if (!message) return "No error message";
	if (message.error && typeof message.error.message === "string") return message.error.message;
	return message;
}
function eventFromException(stackParser, exception, hint, attachStacktrace) {
	const event = eventFromUnknownInput(stackParser, exception, hint?.syntheticException || void 0, attachStacktrace);
	addExceptionMechanism(event);
	event.level = "error";
	if (hint?.event_id) event.event_id = hint.event_id;
	return resolvedSyncPromise(event);
}
function eventFromMessage(stackParser, message, level = "info", hint, attachStacktrace) {
	const event = eventFromString(stackParser, message, hint?.syntheticException || void 0, attachStacktrace);
	event.level = level;
	if (hint?.event_id) event.event_id = hint.event_id;
	return resolvedSyncPromise(event);
}
function eventFromUnknownInput(stackParser, exception, syntheticException, attachStacktrace, isUnhandledRejection) {
	let event;
	if (isErrorEvent(exception) && exception.error) return eventFromError(stackParser, exception.error);
	if (isDOMError(exception) || isDOMException(exception)) {
		const domException = exception;
		if ("stack" in exception) event = eventFromError(stackParser, exception);
		else {
			const name = domException.name || (isDOMError(domException) ? "DOMError" : "DOMException");
			const message = domException.message ? `${name}: ${domException.message}` : name;
			event = eventFromString(stackParser, message, syntheticException, attachStacktrace);
			addExceptionTypeValue(event, message);
		}
		if ("code" in domException) event.tags = {
			...event.tags,
			"DOMException.code": `${domException.code}`
		};
		return event;
	}
	if (isError(exception)) return eventFromError(stackParser, exception);
	if (isPlainObject(exception) || isEvent(exception)) {
		event = eventFromPlainObject(stackParser, exception, syntheticException, isUnhandledRejection);
		addExceptionMechanism(event, { synthetic: true });
		return event;
	}
	event = eventFromString(stackParser, exception, syntheticException, attachStacktrace);
	addExceptionTypeValue(event, `${exception}`, void 0);
	addExceptionMechanism(event, { synthetic: true });
	return event;
}
function eventFromString(stackParser, message, syntheticException, attachStacktrace) {
	const event = {};
	if (attachStacktrace && syntheticException) {
		const frames = parseStackFrames(stackParser, syntheticException);
		if (frames.length) event.exception = { values: [{
			value: message,
			stacktrace: { frames }
		}] };
		addExceptionMechanism(event, { synthetic: true });
	}
	if (isParameterizedString(message)) {
		const { __sentry_template_string__, __sentry_template_values__ } = message;
		event.logentry = {
			message: __sentry_template_string__,
			params: __sentry_template_values__
		};
		return event;
	}
	event.message = message;
	return event;
}
function getNonErrorObjectExceptionValue(exception, { isUnhandledRejection }) {
	const keys = extractExceptionKeysForMessage(exception);
	const captureType = isUnhandledRejection ? "promise rejection" : "exception";
	if (isErrorEvent(exception)) return `Event \`ErrorEvent\` captured as ${captureType} with message \`${exception.message}\``;
	if (isEvent(exception)) return `Event \`${getObjectClassName(exception)}\` (type=${exception.type}) captured as ${captureType}`;
	return `Object captured as ${captureType} with keys: ${keys}`;
}
function getObjectClassName(obj) {
	try {
		const prototype = Object.getPrototypeOf(obj);
		return prototype ? prototype.constructor.name : void 0;
	} catch {}
}
function getErrorPropertyFromObject(obj) {
	for (const prop in obj) if (Object.prototype.hasOwnProperty.call(obj, prop)) {
		const value = obj[prop];
		if (value instanceof Error) return value;
	}
}
var DEFAULT_FLUSH_INTERVAL = 5e3;
var BrowserClient = class extends Client {
	constructor(options) {
		const opts = applyDefaultOptions(options);
		applySdkMetadata(opts, "browser", ["browser"], WINDOW.SENTRY_SDK_SOURCE || getSDKSource());
		super(opts);
		const { sendDefaultPii, sendClientReports, enableLogs, _experiments } = this._options;
		const shouldEnableLogs = enableLogs ?? _experiments?.enableLogs;
		if (WINDOW.document && (sendClientReports || shouldEnableLogs)) WINDOW.document.addEventListener("visibilitychange", () => {
			if (WINDOW.document.visibilityState === "hidden") {
				if (sendClientReports) this._flushOutcomes();
				if (shouldEnableLogs) _INTERNAL_flushLogsBuffer(this);
			}
		});
		if (shouldEnableLogs) {
			this.on("flush", () => {
				_INTERNAL_flushLogsBuffer(this);
			});
			this.on("afterCaptureLog", () => {
				if (this._logFlushIdleTimeout) clearTimeout(this._logFlushIdleTimeout);
				this._logFlushIdleTimeout = setTimeout(() => {
					_INTERNAL_flushLogsBuffer(this);
				}, DEFAULT_FLUSH_INTERVAL);
			});
		}
		if (sendDefaultPii) {
			this.on("postprocessEvent", addAutoIpAddressToUser);
			this.on("beforeSendSession", addAutoIpAddressToSession);
		}
	}
	eventFromException(exception, hint) {
		return eventFromException(this._options.stackParser, exception, hint, this._options.attachStacktrace);
	}
	eventFromMessage(message, level = "info", hint) {
		return eventFromMessage(this._options.stackParser, message, level, hint, this._options.attachStacktrace);
	}
	_prepareEvent(event, hint, currentScope, isolationScope) {
		event.platform = event.platform || "javascript";
		return super._prepareEvent(event, hint, currentScope, isolationScope);
	}
};
function applyDefaultOptions(optionsArg) {
	return {
		release: typeof __SENTRY_RELEASE__ === "string" ? __SENTRY_RELEASE__ : WINDOW.SENTRY_RELEASE?.id,
		sendClientReports: true,
		parentSpanIsAlwaysRootSpan: true,
		...optionsArg
	};
}
var DEBUG_BUILD$2 = typeof __SENTRY_DEBUG__ === "undefined" || __SENTRY_DEBUG__;
var WINDOW$1 = GLOBAL_OBJ;
var DEBOUNCE_DURATION = 1e3;
var debounceTimerID;
var lastCapturedEventType;
var lastCapturedEventTargetId;
function addClickKeypressInstrumentationHandler(handler) {
	const type = "dom";
	addHandler(type, handler);
	maybeInstrument(type, instrumentDOM);
}
function instrumentDOM() {
	if (!WINDOW$1.document) return;
	const triggerDOMHandler = triggerHandlers.bind(null, "dom");
	const globalDOMEventHandler = makeDOMEventHandler(triggerDOMHandler, true);
	WINDOW$1.document.addEventListener("click", globalDOMEventHandler, false);
	WINDOW$1.document.addEventListener("keypress", globalDOMEventHandler, false);
	["EventTarget", "Node"].forEach((target) => {
		const proto = WINDOW$1[target]?.prototype;
		if (!proto?.hasOwnProperty?.("addEventListener")) return;
		fill(proto, "addEventListener", function(originalAddEventListener) {
			return function(type, listener, options) {
				if (type === "click" || type == "keypress") try {
					const handlers$1 = this.__sentry_instrumentation_handlers__ = this.__sentry_instrumentation_handlers__ || {};
					const handlerForType = handlers$1[type] = handlers$1[type] || { refCount: 0 };
					if (!handlerForType.handler) {
						const handler = makeDOMEventHandler(triggerDOMHandler);
						handlerForType.handler = handler;
						originalAddEventListener.call(this, type, handler, options);
					}
					handlerForType.refCount++;
				} catch {}
				return originalAddEventListener.call(this, type, listener, options);
			};
		});
		fill(proto, "removeEventListener", function(originalRemoveEventListener) {
			return function(type, listener, options) {
				if (type === "click" || type == "keypress") try {
					const handlers$1 = this.__sentry_instrumentation_handlers__ || {};
					const handlerForType = handlers$1[type];
					if (handlerForType) {
						handlerForType.refCount--;
						if (handlerForType.refCount <= 0) {
							originalRemoveEventListener.call(this, type, handlerForType.handler, options);
							handlerForType.handler = void 0;
							delete handlers$1[type];
						}
						if (Object.keys(handlers$1).length === 0) delete this.__sentry_instrumentation_handlers__;
					}
				} catch {}
				return originalRemoveEventListener.call(this, type, listener, options);
			};
		});
	});
}
function isSimilarToLastCapturedEvent(event) {
	if (event.type !== lastCapturedEventType) return false;
	try {
		if (!event.target || event.target._sentryId !== lastCapturedEventTargetId) return false;
	} catch {}
	return true;
}
function shouldSkipDOMEvent(eventType, target) {
	if (eventType !== "keypress") return false;
	if (!target?.tagName) return true;
	if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return false;
	return true;
}
function makeDOMEventHandler(handler, globalListener = false) {
	return (event) => {
		if (!event || event["_sentryCaptured"]) return;
		const target = getEventTarget(event);
		if (shouldSkipDOMEvent(event.type, target)) return;
		addNonEnumerableProperty(event, "_sentryCaptured", true);
		if (target && !target._sentryId) addNonEnumerableProperty(target, "_sentryId", uuid4());
		const name = event.type === "keypress" ? "input" : event.type;
		if (!isSimilarToLastCapturedEvent(event)) {
			handler({
				event,
				name,
				global: globalListener
			});
			lastCapturedEventType = event.type;
			lastCapturedEventTargetId = target ? target._sentryId : void 0;
		}
		clearTimeout(debounceTimerID);
		debounceTimerID = WINDOW$1.setTimeout(() => {
			lastCapturedEventTargetId = void 0;
			lastCapturedEventType = void 0;
		}, DEBOUNCE_DURATION);
	};
}
function getEventTarget(event) {
	try {
		return event.target;
	} catch {
		return null;
	}
}
var lastHref;
function addHistoryInstrumentationHandler(handler) {
	const type = "history";
	addHandler(type, handler);
	maybeInstrument(type, instrumentHistory);
}
function instrumentHistory() {
	WINDOW$1.addEventListener("popstate", () => {
		const to = WINDOW$1.location.href;
		const from = lastHref;
		lastHref = to;
		if (from === to) return;
		triggerHandlers("history", {
			from,
			to
		});
	});
	if (!supportsHistory()) return;
	function historyReplacementFunction(originalHistoryFunction) {
		return function(...args) {
			const url = args.length > 2 ? args[2] : void 0;
			if (url) {
				const from = lastHref;
				const to = getAbsoluteUrl(String(url));
				lastHref = to;
				if (from === to) return originalHistoryFunction.apply(this, args);
				triggerHandlers("history", {
					from,
					to
				});
			}
			return originalHistoryFunction.apply(this, args);
		};
	}
	fill(WINDOW$1.history, "pushState", historyReplacementFunction);
	fill(WINDOW$1.history, "replaceState", historyReplacementFunction);
}
function getAbsoluteUrl(urlOrPath) {
	try {
		return new URL(urlOrPath, WINDOW$1.location.origin).toString();
	} catch {
		return urlOrPath;
	}
}
var cachedImplementations = {};
function getNativeImplementation(name) {
	const cached = cachedImplementations[name];
	if (cached) return cached;
	let impl = WINDOW$1[name];
	if (isNativeFunction(impl)) return cachedImplementations[name] = impl.bind(WINDOW$1);
	const document$1 = WINDOW$1.document;
	if (document$1 && typeof document$1.createElement === "function") try {
		const sandbox = document$1.createElement("iframe");
		sandbox.hidden = true;
		document$1.head.appendChild(sandbox);
		const contentWindow = sandbox.contentWindow;
		if (contentWindow?.[name]) impl = contentWindow[name];
		document$1.head.removeChild(sandbox);
	} catch (e) {
		DEBUG_BUILD$2 && debug.warn(`Could not create sandbox iframe for ${name} check, bailing to window.${name}: `, e);
	}
	if (!impl) return impl;
	return cachedImplementations[name] = impl.bind(WINDOW$1);
}
function clearCachedImplementation(name) {
	cachedImplementations[name] = void 0;
}
var SENTRY_XHR_DATA_KEY = "__sentry_xhr_v3__";
function addXhrInstrumentationHandler(handler) {
	const type = "xhr";
	addHandler(type, handler);
	maybeInstrument(type, instrumentXHR);
}
function instrumentXHR() {
	if (!WINDOW$1.XMLHttpRequest) return;
	const xhrproto = XMLHttpRequest.prototype;
	xhrproto.open = new Proxy(xhrproto.open, { apply(originalOpen, xhrOpenThisArg, xhrOpenArgArray) {
		const virtualError = /* @__PURE__ */ new Error();
		const startTimestamp = timestampInSeconds() * 1e3;
		const method = isString(xhrOpenArgArray[0]) ? xhrOpenArgArray[0].toUpperCase() : void 0;
		const url = parseXhrUrlArg(xhrOpenArgArray[1]);
		if (!method || !url) return originalOpen.apply(xhrOpenThisArg, xhrOpenArgArray);
		xhrOpenThisArg[SENTRY_XHR_DATA_KEY] = {
			method,
			url,
			request_headers: {}
		};
		if (method === "POST" && url.match(/sentry_key/)) xhrOpenThisArg.__sentry_own_request__ = true;
		const onreadystatechangeHandler = () => {
			const xhrInfo = xhrOpenThisArg[SENTRY_XHR_DATA_KEY];
			if (!xhrInfo) return;
			if (xhrOpenThisArg.readyState === 4) {
				try {
					xhrInfo.status_code = xhrOpenThisArg.status;
				} catch {}
				triggerHandlers("xhr", {
					endTimestamp: timestampInSeconds() * 1e3,
					startTimestamp,
					xhr: xhrOpenThisArg,
					virtualError
				});
			}
		};
		if ("onreadystatechange" in xhrOpenThisArg && typeof xhrOpenThisArg.onreadystatechange === "function") xhrOpenThisArg.onreadystatechange = new Proxy(xhrOpenThisArg.onreadystatechange, { apply(originalOnreadystatechange, onreadystatechangeThisArg, onreadystatechangeArgArray) {
			onreadystatechangeHandler();
			return originalOnreadystatechange.apply(onreadystatechangeThisArg, onreadystatechangeArgArray);
		} });
		else xhrOpenThisArg.addEventListener("readystatechange", onreadystatechangeHandler);
		xhrOpenThisArg.setRequestHeader = new Proxy(xhrOpenThisArg.setRequestHeader, { apply(originalSetRequestHeader, setRequestHeaderThisArg, setRequestHeaderArgArray) {
			const [header, value] = setRequestHeaderArgArray;
			const xhrInfo = setRequestHeaderThisArg[SENTRY_XHR_DATA_KEY];
			if (xhrInfo && isString(header) && isString(value)) xhrInfo.request_headers[header.toLowerCase()] = value;
			return originalSetRequestHeader.apply(setRequestHeaderThisArg, setRequestHeaderArgArray);
		} });
		return originalOpen.apply(xhrOpenThisArg, xhrOpenArgArray);
	} });
	xhrproto.send = new Proxy(xhrproto.send, { apply(originalSend, sendThisArg, sendArgArray) {
		const sentryXhrData = sendThisArg[SENTRY_XHR_DATA_KEY];
		if (!sentryXhrData) return originalSend.apply(sendThisArg, sendArgArray);
		if (sendArgArray[0] !== void 0) sentryXhrData.body = sendArgArray[0];
		triggerHandlers("xhr", {
			startTimestamp: timestampInSeconds() * 1e3,
			xhr: sendThisArg
		});
		return originalSend.apply(sendThisArg, sendArgArray);
	} });
}
function parseXhrUrlArg(url) {
	if (isString(url)) return url;
	try {
		return url.toString();
	} catch {}
}
function makeFetchTransport(options, nativeFetch = getNativeImplementation("fetch")) {
	let pendingBodySize = 0;
	let pendingCount = 0;
	function makeRequest(request) {
		const requestSize = request.body.length;
		pendingBodySize += requestSize;
		pendingCount++;
		const requestOptions = {
			body: request.body,
			method: "POST",
			referrerPolicy: "strict-origin",
			headers: options.headers,
			keepalive: pendingBodySize <= 6e4 && pendingCount < 15,
			...options.fetchOptions
		};
		if (!nativeFetch) {
			clearCachedImplementation("fetch");
			return rejectedSyncPromise("No fetch implementation available");
		}
		try {
			return nativeFetch(options.url, requestOptions).then((response) => {
				pendingBodySize -= requestSize;
				pendingCount--;
				return {
					statusCode: response.status,
					headers: {
						"x-sentry-rate-limits": response.headers.get("X-Sentry-Rate-Limits"),
						"retry-after": response.headers.get("Retry-After")
					}
				};
			});
		} catch (e) {
			clearCachedImplementation("fetch");
			pendingBodySize -= requestSize;
			pendingCount--;
			return rejectedSyncPromise(e);
		}
	}
	return createTransport(options, makeRequest);
}
var CHROME_PRIORITY = 30;
var GECKO_PRIORITY = 50;
function createFrame(filename, func, lineno, colno) {
	const frame = {
		filename,
		function: func === "<anonymous>" ? "?" : func,
		in_app: true
	};
	if (lineno !== void 0) frame.lineno = lineno;
	if (colno !== void 0) frame.colno = colno;
	return frame;
}
var chromeRegexNoFnName = /^\s*at (\S+?)(?::(\d+))(?::(\d+))\s*$/i;
var chromeRegex = /^\s*at (?:(.+?\)(?: \[.+\])?|.*?) ?\((?:address at )?)?(?:async )?((?:<anonymous>|[-a-z]+:|.*bundle|\/)?.*?)(?::(\d+))?(?::(\d+))?\)?\s*$/i;
var chromeEvalRegex = /\((\S*)(?::(\d+))(?::(\d+))\)/;
var chromeStackParserFn = (line) => {
	const noFnParts = chromeRegexNoFnName.exec(line);
	if (noFnParts) {
		const [, filename, line$1, col] = noFnParts;
		return createFrame(filename, "?", +line$1, +col);
	}
	const parts = chromeRegex.exec(line);
	if (parts) {
		if (parts[2] && parts[2].indexOf("eval") === 0) {
			const subMatch = chromeEvalRegex.exec(parts[2]);
			if (subMatch) {
				parts[2] = subMatch[1];
				parts[3] = subMatch[2];
				parts[4] = subMatch[3];
			}
		}
		const [func, filename] = extractSafariExtensionDetails(parts[1] || "?", parts[2]);
		return createFrame(filename, func, parts[3] ? +parts[3] : void 0, parts[4] ? +parts[4] : void 0);
	}
};
var chromeStackLineParser = [CHROME_PRIORITY, chromeStackParserFn];
var geckoREgex = /^\s*(.*?)(?:\((.*?)\))?(?:^|@)?((?:[-a-z]+)?:\/.*?|\[native code\]|[^@]*(?:bundle|\d+\.js)|\/[\w\-. /=]+)(?::(\d+))?(?::(\d+))?\s*$/i;
var geckoEvalRegex = /(\S+) line (\d+)(?: > eval line \d+)* > eval/i;
var gecko = (line) => {
	const parts = geckoREgex.exec(line);
	if (parts) {
		if (parts[3] && parts[3].indexOf(" > eval") > -1) {
			const subMatch = geckoEvalRegex.exec(parts[3]);
			if (subMatch) {
				parts[1] = parts[1] || "eval";
				parts[3] = subMatch[1];
				parts[4] = subMatch[2];
				parts[5] = "";
			}
		}
		let filename = parts[3];
		let func = parts[1] || "?";
		[func, filename] = extractSafariExtensionDetails(func, filename);
		return createFrame(filename, func, parts[4] ? +parts[4] : void 0, parts[5] ? +parts[5] : void 0);
	}
};
var defaultStackParser = createStackParser(...[chromeStackLineParser, [GECKO_PRIORITY, gecko]]);
var extractSafariExtensionDetails = (func, filename) => {
	const isSafariExtension = func.indexOf("safari-extension") !== -1;
	const isSafariWebExtension = func.indexOf("safari-web-extension") !== -1;
	return isSafariExtension || isSafariWebExtension ? [func.indexOf("@") !== -1 ? func.split("@")[0] : "?", isSafariExtension ? `safari-extension:${filename}` : `safari-web-extension:${filename}`] : [func, filename];
};
var DEBUG_BUILD$1 = typeof __SENTRY_DEBUG__ === "undefined" || __SENTRY_DEBUG__;
var MAX_ALLOWED_STRING_LENGTH = 1024;
var INTEGRATION_NAME$3 = "Breadcrumbs";
var _breadcrumbsIntegration = ((options = {}) => {
	const _options = {
		console: true,
		dom: true,
		fetch: true,
		history: true,
		sentry: true,
		xhr: true,
		...options
	};
	return {
		name: INTEGRATION_NAME$3,
		setup(client) {
			if (_options.console) addConsoleInstrumentationHandler(_getConsoleBreadcrumbHandler(client));
			if (_options.dom) addClickKeypressInstrumentationHandler(_getDomBreadcrumbHandler(client, _options.dom));
			if (_options.xhr) addXhrInstrumentationHandler(_getXhrBreadcrumbHandler(client));
			if (_options.fetch) addFetchInstrumentationHandler(_getFetchBreadcrumbHandler(client));
			if (_options.history) addHistoryInstrumentationHandler(_getHistoryBreadcrumbHandler(client));
			if (_options.sentry) client.on("beforeSendEvent", _getSentryBreadcrumbHandler(client));
		}
	};
});
var breadcrumbsIntegration = defineIntegration(_breadcrumbsIntegration);
function _getSentryBreadcrumbHandler(client) {
	return function addSentryBreadcrumb(event) {
		if (getClient() !== client) return;
		addBreadcrumb({
			category: `sentry.${event.type === "transaction" ? "transaction" : "event"}`,
			event_id: event.event_id,
			level: event.level,
			message: getEventDescription(event)
		}, { event });
	};
}
function _getDomBreadcrumbHandler(client, dom) {
	return function _innerDomBreadcrumb(handlerData) {
		if (getClient() !== client) return;
		let target;
		let componentName;
		let keyAttrs = typeof dom === "object" ? dom.serializeAttribute : void 0;
		let maxStringLength = typeof dom === "object" && typeof dom.maxStringLength === "number" ? dom.maxStringLength : void 0;
		if (maxStringLength && maxStringLength > MAX_ALLOWED_STRING_LENGTH) {
			DEBUG_BUILD$1 && debug.warn(`\`dom.maxStringLength\` cannot exceed ${MAX_ALLOWED_STRING_LENGTH}, but a value of ${maxStringLength} was configured. Sentry will use ${MAX_ALLOWED_STRING_LENGTH} instead.`);
			maxStringLength = MAX_ALLOWED_STRING_LENGTH;
		}
		if (typeof keyAttrs === "string") keyAttrs = [keyAttrs];
		try {
			const event = handlerData.event;
			const element = _isEvent(event) ? event.target : event;
			target = htmlTreeAsString(element, {
				keyAttrs,
				maxStringLength
			});
			componentName = getComponentName(element);
		} catch {
			target = "<unknown>";
		}
		if (target.length === 0) return;
		const breadcrumb = {
			category: `ui.${handlerData.name}`,
			message: target
		};
		if (componentName) breadcrumb.data = { "ui.component_name": componentName };
		addBreadcrumb(breadcrumb, {
			event: handlerData.event,
			name: handlerData.name,
			global: handlerData.global
		});
	};
}
function _getConsoleBreadcrumbHandler(client) {
	return function _consoleBreadcrumb(handlerData) {
		if (getClient() !== client) return;
		const breadcrumb = {
			category: "console",
			data: {
				arguments: handlerData.args,
				logger: "console"
			},
			level: severityLevelFromString(handlerData.level),
			message: safeJoin(handlerData.args, " ")
		};
		if (handlerData.level === "assert") if (handlerData.args[0] === false) {
			breadcrumb.message = `Assertion failed: ${safeJoin(handlerData.args.slice(1), " ") || "console.assert"}`;
			breadcrumb.data.arguments = handlerData.args.slice(1);
		} else return;
		addBreadcrumb(breadcrumb, {
			input: handlerData.args,
			level: handlerData.level
		});
	};
}
function _getXhrBreadcrumbHandler(client) {
	return function _xhrBreadcrumb(handlerData) {
		if (getClient() !== client) return;
		const { startTimestamp, endTimestamp } = handlerData;
		const sentryXhrData = handlerData.xhr[SENTRY_XHR_DATA_KEY];
		if (!startTimestamp || !endTimestamp || !sentryXhrData) return;
		const { method, url, status_code, body } = sentryXhrData;
		const data = {
			method,
			url,
			status_code
		};
		const hint = {
			xhr: handlerData.xhr,
			input: body,
			startTimestamp,
			endTimestamp
		};
		const breadcrumb = {
			category: "xhr",
			data,
			type: "http",
			level: getBreadcrumbLogLevelFromHttpStatusCode(status_code)
		};
		client.emit("beforeOutgoingRequestBreadcrumb", breadcrumb, hint);
		addBreadcrumb(breadcrumb, hint);
	};
}
function _getFetchBreadcrumbHandler(client) {
	return function _fetchBreadcrumb(handlerData) {
		if (getClient() !== client) return;
		const { startTimestamp, endTimestamp } = handlerData;
		if (!endTimestamp) return;
		if (handlerData.fetchData.url.match(/sentry_key/) && handlerData.fetchData.method === "POST") return;
		handlerData.fetchData.method, handlerData.fetchData.url;
		if (handlerData.error) {
			const data = handlerData.fetchData;
			const hint = {
				data: handlerData.error,
				input: handlerData.args,
				startTimestamp,
				endTimestamp
			};
			const breadcrumb = {
				category: "fetch",
				data,
				level: "error",
				type: "http"
			};
			client.emit("beforeOutgoingRequestBreadcrumb", breadcrumb, hint);
			addBreadcrumb(breadcrumb, hint);
		} else {
			const response = handlerData.response;
			const data = {
				...handlerData.fetchData,
				status_code: response?.status
			};
			handlerData.fetchData.request_body_size;
			handlerData.fetchData.response_body_size;
			response?.status;
			const hint = {
				input: handlerData.args,
				response,
				startTimestamp,
				endTimestamp
			};
			const breadcrumb = {
				category: "fetch",
				data,
				type: "http",
				level: getBreadcrumbLogLevelFromHttpStatusCode(data.status_code)
			};
			client.emit("beforeOutgoingRequestBreadcrumb", breadcrumb, hint);
			addBreadcrumb(breadcrumb, hint);
		}
	};
}
function _getHistoryBreadcrumbHandler(client) {
	return function _historyBreadcrumb(handlerData) {
		if (getClient() !== client) return;
		let from = handlerData.from;
		let to = handlerData.to;
		const parsedLoc = parseUrl(WINDOW.location.href);
		let parsedFrom = from ? parseUrl(from) : void 0;
		const parsedTo = parseUrl(to);
		if (!parsedFrom?.path) parsedFrom = parsedLoc;
		if (parsedLoc.protocol === parsedTo.protocol && parsedLoc.host === parsedTo.host) to = parsedTo.relative;
		if (parsedLoc.protocol === parsedFrom.protocol && parsedLoc.host === parsedFrom.host) from = parsedFrom.relative;
		addBreadcrumb({
			category: "navigation",
			data: {
				from,
				to
			}
		});
	};
}
function _isEvent(event) {
	return !!event && !!event.target;
}
var DEFAULT_EVENT_TARGET = [
	"EventTarget",
	"Window",
	"Node",
	"ApplicationCache",
	"AudioTrackList",
	"BroadcastChannel",
	"ChannelMergerNode",
	"CryptoOperation",
	"EventSource",
	"FileReader",
	"HTMLUnknownElement",
	"IDBDatabase",
	"IDBRequest",
	"IDBTransaction",
	"KeyOperation",
	"MediaController",
	"MessagePort",
	"ModalWindow",
	"Notification",
	"SVGElementInstance",
	"Screen",
	"SharedWorker",
	"TextTrack",
	"TextTrackCue",
	"TextTrackList",
	"WebSocket",
	"WebSocketWorker",
	"Worker",
	"XMLHttpRequest",
	"XMLHttpRequestEventTarget",
	"XMLHttpRequestUpload"
];
var INTEGRATION_NAME$2 = "BrowserApiErrors";
var _browserApiErrorsIntegration = ((options = {}) => {
	const _options = {
		XMLHttpRequest: true,
		eventTarget: true,
		requestAnimationFrame: true,
		setInterval: true,
		setTimeout: true,
		unregisterOriginalCallbacks: false,
		...options
	};
	return {
		name: INTEGRATION_NAME$2,
		setupOnce() {
			if (_options.setTimeout) fill(WINDOW, "setTimeout", _wrapTimeFunction);
			if (_options.setInterval) fill(WINDOW, "setInterval", _wrapTimeFunction);
			if (_options.requestAnimationFrame) fill(WINDOW, "requestAnimationFrame", _wrapRAF);
			if (_options.XMLHttpRequest && "XMLHttpRequest" in WINDOW) fill(XMLHttpRequest.prototype, "send", _wrapXHR);
			const eventTargetOption = _options.eventTarget;
			if (eventTargetOption) (Array.isArray(eventTargetOption) ? eventTargetOption : DEFAULT_EVENT_TARGET).forEach((target) => _wrapEventTarget(target, _options));
		}
	};
});
var browserApiErrorsIntegration = defineIntegration(_browserApiErrorsIntegration);
function _wrapTimeFunction(original) {
	return function(...args) {
		const originalCallback = args[0];
		args[0] = wrap(originalCallback, { mechanism: {
			data: { function: getFunctionName(original) },
			handled: false,
			type: "instrument"
		} });
		return original.apply(this, args);
	};
}
function _wrapRAF(original) {
	return function(callback) {
		return original.apply(this, [wrap(callback, { mechanism: {
			data: {
				function: "requestAnimationFrame",
				handler: getFunctionName(original)
			},
			handled: false,
			type: "instrument"
		} })]);
	};
}
function _wrapXHR(originalSend) {
	return function(...args) {
		const xhr = this;
		[
			"onload",
			"onerror",
			"onprogress",
			"onreadystatechange"
		].forEach((prop) => {
			if (prop in xhr && typeof xhr[prop] === "function") fill(xhr, prop, function(original) {
				const wrapOptions = { mechanism: {
					data: {
						function: prop,
						handler: getFunctionName(original)
					},
					handled: false,
					type: "instrument"
				} };
				const originalFunction = getOriginalFunction(original);
				if (originalFunction) wrapOptions.mechanism.data.handler = getFunctionName(originalFunction);
				return wrap(original, wrapOptions);
			});
		});
		return originalSend.apply(this, args);
	};
}
function _wrapEventTarget(target, integrationOptions) {
	const proto = WINDOW[target]?.prototype;
	if (!proto?.hasOwnProperty?.("addEventListener")) return;
	fill(proto, "addEventListener", function(original) {
		return function(eventName, fn, options) {
			try {
				if (isEventListenerObject(fn)) fn.handleEvent = wrap(fn.handleEvent, { mechanism: {
					data: {
						function: "handleEvent",
						handler: getFunctionName(fn),
						target
					},
					handled: false,
					type: "instrument"
				} });
			} catch {}
			if (integrationOptions.unregisterOriginalCallbacks) unregisterOriginalCallback(this, eventName, fn);
			return original.apply(this, [
				eventName,
				wrap(fn, { mechanism: {
					data: {
						function: "addEventListener",
						handler: getFunctionName(fn),
						target
					},
					handled: false,
					type: "instrument"
				} }),
				options
			]);
		};
	});
	fill(proto, "removeEventListener", function(originalRemoveEventListener) {
		return function(eventName, fn, options) {
			try {
				const originalEventHandler = fn.__sentry_wrapped__;
				if (originalEventHandler) originalRemoveEventListener.call(this, eventName, originalEventHandler, options);
			} catch {}
			return originalRemoveEventListener.call(this, eventName, fn, options);
		};
	});
}
function isEventListenerObject(obj) {
	return typeof obj.handleEvent === "function";
}
function unregisterOriginalCallback(target, eventName, fn) {
	if (target && typeof target === "object" && "removeEventListener" in target && typeof target.removeEventListener === "function") target.removeEventListener(eventName, fn);
}
var browserSessionIntegration = defineIntegration(() => {
	return {
		name: "BrowserSession",
		setupOnce() {
			if (typeof WINDOW.document === "undefined") {
				DEBUG_BUILD$1 && debug.warn("Using the `browserSessionIntegration` in non-browser environments is not supported.");
				return;
			}
			startSession({ ignoreDuration: true });
			captureSession();
			addHistoryInstrumentationHandler(({ from, to }) => {
				if (from !== void 0 && from !== to) {
					startSession({ ignoreDuration: true });
					captureSession();
				}
			});
		}
	};
});
var INTEGRATION_NAME$1 = "GlobalHandlers";
var _globalHandlersIntegration = ((options = {}) => {
	const _options = {
		onerror: true,
		onunhandledrejection: true,
		...options
	};
	return {
		name: INTEGRATION_NAME$1,
		setupOnce() {
			Error.stackTraceLimit = 50;
		},
		setup(client) {
			if (_options.onerror) {
				_installGlobalOnErrorHandler(client);
				globalHandlerLog("onerror");
			}
			if (_options.onunhandledrejection) {
				_installGlobalOnUnhandledRejectionHandler(client);
				globalHandlerLog("onunhandledrejection");
			}
		}
	};
});
var globalHandlersIntegration = defineIntegration(_globalHandlersIntegration);
function _installGlobalOnErrorHandler(client) {
	addGlobalErrorInstrumentationHandler((data) => {
		const { stackParser, attachStacktrace } = getOptions();
		if (getClient() !== client || shouldIgnoreOnError()) return;
		const { msg, url, line, column, error: error$1 } = data;
		const event = _enhanceEventWithInitialFrame(eventFromUnknownInput(stackParser, error$1 || msg, void 0, attachStacktrace, false), url, line, column);
		event.level = "error";
		captureEvent(event, {
			originalException: error$1,
			mechanism: {
				handled: false,
				type: "onerror"
			}
		});
	});
}
function _installGlobalOnUnhandledRejectionHandler(client) {
	addGlobalUnhandledRejectionInstrumentationHandler((e) => {
		const { stackParser, attachStacktrace } = getOptions();
		if (getClient() !== client || shouldIgnoreOnError()) return;
		const error$1 = _getUnhandledRejectionError(e);
		const event = isPrimitive(error$1) ? _eventFromRejectionWithPrimitive(error$1) : eventFromUnknownInput(stackParser, error$1, void 0, attachStacktrace, true);
		event.level = "error";
		captureEvent(event, {
			originalException: error$1,
			mechanism: {
				handled: false,
				type: "onunhandledrejection"
			}
		});
	});
}
function _getUnhandledRejectionError(error$1) {
	if (isPrimitive(error$1)) return error$1;
	try {
		if ("reason" in error$1) return error$1.reason;
		if ("detail" in error$1 && "reason" in error$1.detail) return error$1.detail.reason;
	} catch {}
	return error$1;
}
function _eventFromRejectionWithPrimitive(reason) {
	return { exception: { values: [{
		type: "UnhandledRejection",
		value: `Non-Error promise rejection captured with value: ${String(reason)}`
	}] } };
}
function _enhanceEventWithInitialFrame(event, url, line, column) {
	const e = event.exception = event.exception || {};
	const ev = e.values = e.values || [];
	const ev0 = ev[0] = ev[0] || {};
	const ev0s = ev0.stacktrace = ev0.stacktrace || {};
	const ev0sf = ev0s.frames = ev0s.frames || [];
	const colno = column;
	const lineno = line;
	const filename = isString(url) && url.length > 0 ? url : getLocationHref();
	if (ev0sf.length === 0) ev0sf.push({
		colno,
		filename,
		function: "?",
		in_app: true,
		lineno
	});
	return event;
}
function globalHandlerLog(type) {
	DEBUG_BUILD$1 && debug.log(`Global Handler attached: ${type}`);
}
function getOptions() {
	return getClient()?.getOptions() || {
		stackParser: () => [],
		attachStacktrace: false
	};
}
var httpContextIntegration = defineIntegration(() => {
	return {
		name: "HttpContext",
		preprocessEvent(event) {
			if (!WINDOW.navigator && !WINDOW.location && !WINDOW.document) return;
			const reqData = getHttpRequestData();
			const headers = {
				...reqData.headers,
				...event.request?.headers
			};
			event.request = {
				...reqData,
				...event.request,
				headers
			};
		}
	};
});
var DEFAULT_KEY = "cause";
var DEFAULT_LIMIT = 5;
var INTEGRATION_NAME = "LinkedErrors";
var _linkedErrorsIntegration = ((options = {}) => {
	const limit = options.limit || DEFAULT_LIMIT;
	const key = options.key || DEFAULT_KEY;
	return {
		name: INTEGRATION_NAME,
		preprocessEvent(event, hint, client) {
			applyAggregateErrorsToEvent(exceptionFromError, client.getOptions().stackParser, key, limit, event, hint);
		}
	};
});
var linkedErrorsIntegration = defineIntegration(_linkedErrorsIntegration);
function checkAndWarnIfIsEmbeddedBrowserExtension() {
	if (_isEmbeddedBrowserExtension()) {
		if (DEBUG_BUILD$1) consoleSandbox(() => {
			console.error("[Sentry] You cannot use Sentry.init() in a browser extension, see: https://docs.sentry.io/platforms/javascript/best-practices/browser-extensions/");
		});
		return true;
	}
	return false;
}
function _isEmbeddedBrowserExtension() {
	if (typeof WINDOW.window === "undefined") return false;
	const _window = WINDOW;
	if (_window.nw) return false;
	if (!(_window["chrome"] || _window["browser"])?.runtime?.id) return false;
	const href = getLocationHref();
	return !(WINDOW === WINDOW.top && [
		"chrome-extension",
		"moz-extension",
		"ms-browser-extension",
		"safari-web-extension"
	].some((protocol) => href.startsWith(`${protocol}://`)));
}
function getDefaultIntegrations(_options) {
	return [
		inboundFiltersIntegration(),
		functionToStringIntegration(),
		browserApiErrorsIntegration(),
		breadcrumbsIntegration(),
		globalHandlersIntegration(),
		linkedErrorsIntegration(),
		dedupeIntegration(),
		httpContextIntegration(),
		browserSessionIntegration()
	];
}
function init(options = {}) {
	const shouldDisableBecauseIsBrowserExtenstion = !options.skipBrowserExtensionCheck && checkAndWarnIfIsEmbeddedBrowserExtension();
	return initAndBind(BrowserClient, {
		...options,
		enabled: shouldDisableBecauseIsBrowserExtenstion ? false : options.enabled,
		stackParser: stackParserFromStackParserOptions(options.stackParser || defaultStackParser),
		integrations: getIntegrationsToSetup({
			integrations: options.integrations,
			defaultIntegrations: options.defaultIntegrations == null ? getDefaultIntegrations() : options.defaultIntegrations
		}),
		transport: options.transport || makeFetchTransport
	});
}
function showReportDialog(options = {}) {
	const optionalDocument = WINDOW.document;
	const injectionPoint = optionalDocument?.head || optionalDocument?.body;
	if (!injectionPoint) {
		DEBUG_BUILD$1 && debug.error("[showReportDialog] Global document not defined");
		return;
	}
	const scope = getCurrentScope();
	const dsn = getClient()?.getDsn();
	if (!dsn) {
		DEBUG_BUILD$1 && debug.error("[showReportDialog] DSN not configured");
		return;
	}
	const mergedOptions = {
		...options,
		user: {
			...scope.getUser(),
			...options.user
		},
		eventId: options.eventId || lastEventId()
	};
	const script = WINDOW.document.createElement("script");
	script.async = true;
	script.crossOrigin = "anonymous";
	script.src = getReportDialogEndpoint(dsn, mergedOptions);
	const { onLoad, onClose } = mergedOptions;
	if (onLoad) script.onload = onLoad;
	if (onClose) {
		const reportDialogClosedMessageHandler = (event) => {
			if (event.data === "__sentry_reportdialog_closed__") try {
				onClose();
			} finally {
				WINDOW.removeEventListener("message", reportDialogClosedMessageHandler);
			}
		};
		WINDOW.addEventListener("message", reportDialogClosedMessageHandler);
	}
	injectionPoint.appendChild(script);
}
/**
* @license React
* react.production.min.js
*
* Copyright (c) Facebook, Inc. and its affiliates.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*/
var require_react_production_min = /* @__PURE__ */ __commonJSMin(((exports) => {
	var l$2 = Symbol.for("react.element"), n$1 = Symbol.for("react.portal"), p$3 = Symbol.for("react.fragment"), q$2 = Symbol.for("react.strict_mode"), r$2 = Symbol.for("react.profiler"), t$1 = Symbol.for("react.provider"), u$2 = Symbol.for("react.context"), v$2 = Symbol.for("react.forward_ref"), w = Symbol.for("react.suspense"), x$1 = Symbol.for("react.memo"), y$1 = Symbol.for("react.lazy"), z$3 = Symbol.iterator;
	function A$2(a) {
		if (null === a || "object" !== typeof a) return null;
		a = z$3 && a[z$3] || a["@@iterator"];
		return "function" === typeof a ? a : null;
	}
	var B$2 = {
		isMounted: function() {
			return !1;
		},
		enqueueForceUpdate: function() {},
		enqueueReplaceState: function() {},
		enqueueSetState: function() {}
	}, C$1 = Object.assign, D$2 = {};
	function E$3(a, b$1, e) {
		this.props = a;
		this.context = b$1;
		this.refs = D$2;
		this.updater = e || B$2;
	}
	E$3.prototype.isReactComponent = {};
	E$3.prototype.setState = function(a, b$1) {
		if ("object" !== typeof a && "function" !== typeof a && null != a) throw Error("setState(...): takes an object of state variables to update or a function which returns an object of state variables.");
		this.updater.enqueueSetState(this, a, b$1, "setState");
	};
	E$3.prototype.forceUpdate = function(a) {
		this.updater.enqueueForceUpdate(this, a, "forceUpdate");
	};
	function F$1() {}
	F$1.prototype = E$3.prototype;
	function G$2(a, b$1, e) {
		this.props = a;
		this.context = b$1;
		this.refs = D$2;
		this.updater = e || B$2;
	}
	var H$3 = G$2.prototype = new F$1();
	H$3.constructor = G$2;
	C$1(H$3, E$3.prototype);
	H$3.isPureReactComponent = !0;
	var I$3 = Array.isArray, J$2 = Object.prototype.hasOwnProperty, K$2 = { current: null }, L$2 = {
		key: !0,
		ref: !0,
		__self: !0,
		__source: !0
	};
	function M$3(a, b$1, e) {
		var d, c = {}, k$2 = null, h$1 = null;
		if (null != b$1) for (d in void 0 !== b$1.ref && (h$1 = b$1.ref), void 0 !== b$1.key && (k$2 = "" + b$1.key), b$1) J$2.call(b$1, d) && !L$2.hasOwnProperty(d) && (c[d] = b$1[d]);
		var g$2 = arguments.length - 2;
		if (1 === g$2) c.children = e;
		else if (1 < g$2) {
			for (var f$2 = Array(g$2), m$2 = 0; m$2 < g$2; m$2++) f$2[m$2] = arguments[m$2 + 2];
			c.children = f$2;
		}
		if (a && a.defaultProps) for (d in g$2 = a.defaultProps, g$2) void 0 === c[d] && (c[d] = g$2[d]);
		return {
			$$typeof: l$2,
			type: a,
			key: k$2,
			ref: h$1,
			props: c,
			_owner: K$2.current
		};
	}
	function N$3(a, b$1) {
		return {
			$$typeof: l$2,
			type: a.type,
			key: b$1,
			ref: a.ref,
			props: a.props,
			_owner: a._owner
		};
	}
	function O$3(a) {
		return "object" === typeof a && null !== a && a.$$typeof === l$2;
	}
	function escape(a) {
		var b$1 = {
			"=": "=0",
			":": "=2"
		};
		return "$" + a.replace(/[=:]/g, function(a$1) {
			return b$1[a$1];
		});
	}
	var P$2 = /\/+/g;
	function Q$2(a, b$1) {
		return "object" === typeof a && null !== a && null != a.key ? escape("" + a.key) : b$1.toString(36);
	}
	function R$2(a, b$1, e, d, c) {
		var k$2 = typeof a;
		if ("undefined" === k$2 || "boolean" === k$2) a = null;
		var h$1 = !1;
		if (null === a) h$1 = !0;
		else switch (k$2) {
			case "string":
			case "number":
				h$1 = !0;
				break;
			case "object": switch (a.$$typeof) {
				case l$2:
				case n$1: h$1 = !0;
			}
		}
		if (h$1) return h$1 = a, c = c(h$1), a = "" === d ? "." + Q$2(h$1, 0) : d, I$3(c) ? (e = "", null != a && (e = a.replace(P$2, "$&/") + "/"), R$2(c, b$1, e, "", function(a$1) {
			return a$1;
		})) : null != c && (O$3(c) && (c = N$3(c, e + (!c.key || h$1 && h$1.key === c.key ? "" : ("" + c.key).replace(P$2, "$&/") + "/") + a)), b$1.push(c)), 1;
		h$1 = 0;
		d = "" === d ? "." : d + ":";
		if (I$3(a)) for (var g$2 = 0; g$2 < a.length; g$2++) {
			k$2 = a[g$2];
			var f$2 = d + Q$2(k$2, g$2);
			h$1 += R$2(k$2, b$1, e, f$2, c);
		}
		else if (f$2 = A$2(a), "function" === typeof f$2) for (a = f$2.call(a), g$2 = 0; !(k$2 = a.next()).done;) k$2 = k$2.value, f$2 = d + Q$2(k$2, g$2++), h$1 += R$2(k$2, b$1, e, f$2, c);
		else if ("object" === k$2) throw b$1 = String(a), Error("Objects are not valid as a React child (found: " + ("[object Object]" === b$1 ? "object with keys {" + Object.keys(a).join(", ") + "}" : b$1) + "). If you meant to render a collection of children, use an array instead.");
		return h$1;
	}
	function S$2(a, b$1, e) {
		if (null == a) return a;
		var d = [], c = 0;
		R$2(a, d, "", "", function(a$1) {
			return b$1.call(e, a$1, c++);
		});
		return d;
	}
	function T$2(a) {
		if (-1 === a._status) {
			var b$1 = a._result;
			b$1 = b$1();
			b$1.then(function(b$2) {
				if (0 === a._status || -1 === a._status) a._status = 1, a._result = b$2;
			}, function(b$2) {
				if (0 === a._status || -1 === a._status) a._status = 2, a._result = b$2;
			});
			-1 === a._status && (a._status = 0, a._result = b$1);
		}
		if (1 === a._status) return a._result.default;
		throw a._result;
	}
	var U$3 = { current: null }, V$2 = { transition: null }, W$2 = {
		ReactCurrentDispatcher: U$3,
		ReactCurrentBatchConfig: V$2,
		ReactCurrentOwner: K$2
	};
	function X$1() {
		throw Error("act(...) is not supported in production builds of React.");
	}
	exports.Children = {
		map: S$2,
		forEach: function(a, b$1, e) {
			S$2(a, function() {
				b$1.apply(this, arguments);
			}, e);
		},
		count: function(a) {
			var b$1 = 0;
			S$2(a, function() {
				b$1++;
			});
			return b$1;
		},
		toArray: function(a) {
			return S$2(a, function(a$1) {
				return a$1;
			}) || [];
		},
		only: function(a) {
			if (!O$3(a)) throw Error("React.Children.only expected to receive a single React element child.");
			return a;
		}
	};
	exports.Component = E$3;
	exports.Fragment = p$3;
	exports.Profiler = r$2;
	exports.PureComponent = G$2;
	exports.StrictMode = q$2;
	exports.Suspense = w;
	exports.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = W$2;
	exports.act = X$1;
	exports.cloneElement = function(a, b$1, e) {
		if (null === a || void 0 === a) throw Error("React.cloneElement(...): The argument must be a React element, but you passed " + a + ".");
		var d = C$1({}, a.props), c = a.key, k$2 = a.ref, h$1 = a._owner;
		if (null != b$1) {
			void 0 !== b$1.ref && (k$2 = b$1.ref, h$1 = K$2.current);
			void 0 !== b$1.key && (c = "" + b$1.key);
			if (a.type && a.type.defaultProps) var g$2 = a.type.defaultProps;
			for (f$2 in b$1) J$2.call(b$1, f$2) && !L$2.hasOwnProperty(f$2) && (d[f$2] = void 0 === b$1[f$2] && void 0 !== g$2 ? g$2[f$2] : b$1[f$2]);
		}
		var f$2 = arguments.length - 2;
		if (1 === f$2) d.children = e;
		else if (1 < f$2) {
			g$2 = Array(f$2);
			for (var m$2 = 0; m$2 < f$2; m$2++) g$2[m$2] = arguments[m$2 + 2];
			d.children = g$2;
		}
		return {
			$$typeof: l$2,
			type: a.type,
			key: c,
			ref: k$2,
			props: d,
			_owner: h$1
		};
	};
	exports.createContext = function(a) {
		a = {
			$$typeof: u$2,
			_currentValue: a,
			_currentValue2: a,
			_threadCount: 0,
			Provider: null,
			Consumer: null,
			_defaultValue: null,
			_globalName: null
		};
		a.Provider = {
			$$typeof: t$1,
			_context: a
		};
		return a.Consumer = a;
	};
	exports.createElement = M$3;
	exports.createFactory = function(a) {
		var b$1 = M$3.bind(null, a);
		b$1.type = a;
		return b$1;
	};
	exports.createRef = function() {
		return { current: null };
	};
	exports.forwardRef = function(a) {
		return {
			$$typeof: v$2,
			render: a
		};
	};
	exports.isValidElement = O$3;
	exports.lazy = function(a) {
		return {
			$$typeof: y$1,
			_payload: {
				_status: -1,
				_result: a
			},
			_init: T$2
		};
	};
	exports.memo = function(a, b$1) {
		return {
			$$typeof: x$1,
			type: a,
			compare: void 0 === b$1 ? null : b$1
		};
	};
	exports.startTransition = function(a) {
		var b$1 = V$2.transition;
		V$2.transition = {};
		try {
			a();
		} finally {
			V$2.transition = b$1;
		}
	};
	exports.unstable_act = X$1;
	exports.useCallback = function(a, b$1) {
		return U$3.current.useCallback(a, b$1);
	};
	exports.useContext = function(a) {
		return U$3.current.useContext(a);
	};
	exports.useDebugValue = function() {};
	exports.useDeferredValue = function(a) {
		return U$3.current.useDeferredValue(a);
	};
	exports.useEffect = function(a, b$1) {
		return U$3.current.useEffect(a, b$1);
	};
	exports.useId = function() {
		return U$3.current.useId();
	};
	exports.useImperativeHandle = function(a, b$1, e) {
		return U$3.current.useImperativeHandle(a, b$1, e);
	};
	exports.useInsertionEffect = function(a, b$1) {
		return U$3.current.useInsertionEffect(a, b$1);
	};
	exports.useLayoutEffect = function(a, b$1) {
		return U$3.current.useLayoutEffect(a, b$1);
	};
	exports.useMemo = function(a, b$1) {
		return U$3.current.useMemo(a, b$1);
	};
	exports.useReducer = function(a, b$1, e) {
		return U$3.current.useReducer(a, b$1, e);
	};
	exports.useRef = function(a) {
		return U$3.current.useRef(a);
	};
	exports.useState = function(a) {
		return U$3.current.useState(a);
	};
	exports.useSyncExternalStore = function(a, b$1, e) {
		return U$3.current.useSyncExternalStore(a, b$1, e);
	};
	exports.useTransition = function() {
		return U$3.current.useTransition();
	};
	exports.version = "18.3.1";
}));
var require_react = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = require_react_production_min();
}));
var import_react = /* @__PURE__ */ __toESM(require_react());
function init$1(options) {
	const opts = { ...options };
	applySdkMetadata(opts, "react");
	setContext("react", { version: import_react.version });
	return init(opts);
}
function isAtLeastReact17(reactVersion) {
	const reactMajor = reactVersion.match(/^([^.]+)/);
	return reactMajor !== null && parseInt(reactMajor[0]) >= 17;
}
function setCause(error$1, cause) {
	const seenErrors = /* @__PURE__ */ new WeakSet();
	function recurse(error$2, cause$1) {
		if (seenErrors.has(error$2)) return;
		if (error$2.cause) {
			seenErrors.add(error$2);
			return recurse(error$2.cause, cause$1);
		}
		error$2.cause = cause$1;
	}
	recurse(error$1, cause);
}
function captureReactException(error$1, { componentStack }, hint) {
	if (isAtLeastReact17(import_react.version) && isError(error$1) && componentStack) {
		const errorBoundaryError = new Error(error$1.message);
		errorBoundaryError.name = `React ErrorBoundary ${error$1.name}`;
		errorBoundaryError.stack = componentStack;
		setCause(error$1, errorBoundaryError);
	}
	return withScope((scope) => {
		scope.setContext("react", { componentStack });
		return captureException(error$1, hint);
	});
}
var DEBUG_BUILD = typeof __SENTRY_DEBUG__ === "undefined" || __SENTRY_DEBUG__;
var INITIAL_STATE = {
	componentStack: null,
	error: null,
	eventId: null
};
var ErrorBoundary = class extends import_react.Component {
	constructor(props) {
		super(props);
		this.state = INITIAL_STATE;
		this._openFallbackReportDialog = true;
		const client = getClient();
		if (client && props.showDialog) {
			this._openFallbackReportDialog = false;
			this._cleanupHook = client.on("afterSendEvent", (event) => {
				if (!event.type && this._lastEventId && event.event_id === this._lastEventId) showReportDialog({
					...props.dialogOptions,
					eventId: this._lastEventId
				});
			});
		}
	}
	componentDidCatch(error$1, errorInfo) {
		const { componentStack } = errorInfo;
		const { beforeCapture, onError, showDialog, dialogOptions } = this.props;
		withScope((scope) => {
			if (beforeCapture) beforeCapture(scope, error$1, componentStack);
			const eventId = captureReactException(error$1, errorInfo, { mechanism: { handled: this.props.handled != null ? this.props.handled : !!this.props.fallback } });
			if (onError) onError(error$1, componentStack, eventId);
			if (showDialog) {
				this._lastEventId = eventId;
				if (this._openFallbackReportDialog) showReportDialog({
					...dialogOptions,
					eventId
				});
			}
			this.setState({
				error: error$1,
				componentStack,
				eventId
			});
		});
	}
	componentDidMount() {
		const { onMount } = this.props;
		if (onMount) onMount();
	}
	componentWillUnmount() {
		const { error: error$1, componentStack, eventId } = this.state;
		const { onUnmount } = this.props;
		if (onUnmount) if (this.state === INITIAL_STATE) onUnmount(null, null, null);
		else onUnmount(error$1, componentStack, eventId);
		if (this._cleanupHook) {
			this._cleanupHook();
			this._cleanupHook = void 0;
		}
	}
	resetErrorBoundary() {
		const { onReset } = this.props;
		const { error: error$1, componentStack, eventId } = this.state;
		if (onReset) onReset(error$1, componentStack, eventId);
		this.setState(INITIAL_STATE);
	}
	render() {
		const { fallback, children } = this.props;
		const state = this.state;
		if (state.componentStack === null) return typeof children === "function" ? children() : children;
		const element = typeof fallback === "function" ? import_react.createElement(fallback, {
			error: state.error,
			componentStack: state.componentStack,
			resetError: () => this.resetErrorBoundary(),
			eventId: state.eventId
		}) : fallback;
		if (import_react.isValidElement(element)) return element;
		if (fallback) DEBUG_BUILD && debug.warn("fallback did not produce a valid ReactElement");
		return null;
	}
};
/**
* @license React
* scheduler.production.min.js
*
* Copyright (c) Facebook, Inc. and its affiliates.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*/
var require_scheduler_production_min = /* @__PURE__ */ __commonJSMin(((exports) => {
	function f$1(a, b$1) {
		var c = a.length;
		a.push(b$1);
		a: for (; 0 < c;) {
			var d = c - 1 >>> 1, e = a[d];
			if (0 < g$1(e, b$1)) a[d] = b$1, a[c] = e, c = d;
			else break a;
		}
	}
	function h(a) {
		return 0 === a.length ? null : a[0];
	}
	function k$1(a) {
		if (0 === a.length) return null;
		var b$1 = a[0], c = a.pop();
		if (c !== b$1) {
			a[0] = c;
			a: for (var d = 0, e = a.length, w$1 = e >>> 1; d < w$1;) {
				var m$2 = 2 * (d + 1) - 1, C$2 = a[m$2], n$2 = m$2 + 1, x$2 = a[n$2];
				if (0 > g$1(C$2, c)) n$2 < e && 0 > g$1(x$2, C$2) ? (a[d] = x$2, a[n$2] = c, d = n$2) : (a[d] = C$2, a[m$2] = c, d = m$2);
				else if (n$2 < e && 0 > g$1(x$2, c)) a[d] = x$2, a[n$2] = c, d = n$2;
				else break a;
			}
		}
		return b$1;
	}
	function g$1(a, b$1) {
		var c = a.sortIndex - b$1.sortIndex;
		return 0 !== c ? c : a.id - b$1.id;
	}
	if ("object" === typeof performance && "function" === typeof performance.now) {
		var l$1 = performance;
		exports.unstable_now = function() {
			return l$1.now();
		};
	} else {
		var p$2 = Date, q$1 = p$2.now();
		exports.unstable_now = function() {
			return p$2.now() - q$1;
		};
	}
	var r$1 = [], t = [], u$1 = 1, v$1 = null, y = 3, z$2 = !1, A$1 = !1, B$1 = !1, D$1 = "function" === typeof setTimeout ? setTimeout : null, E$2 = "function" === typeof clearTimeout ? clearTimeout : null, F = "undefined" !== typeof setImmediate ? setImmediate : null;
	"undefined" !== typeof navigator && void 0 !== navigator.scheduling && void 0 !== navigator.scheduling.isInputPending && navigator.scheduling.isInputPending.bind(navigator.scheduling);
	function G$1(a) {
		for (var b$1 = h(t); null !== b$1;) {
			if (null === b$1.callback) k$1(t);
			else if (b$1.startTime <= a) k$1(t), b$1.sortIndex = b$1.expirationTime, f$1(r$1, b$1);
			else break;
			b$1 = h(t);
		}
	}
	function H$2(a) {
		B$1 = !1;
		G$1(a);
		if (!A$1) if (null !== h(r$1)) A$1 = !0, I$2(J$1);
		else {
			var b$1 = h(t);
			null !== b$1 && K$1(H$2, b$1.startTime - a);
		}
	}
	function J$1(a, b$1) {
		A$1 = !1;
		B$1 && (B$1 = !1, E$2(L$1), L$1 = -1);
		z$2 = !0;
		var c = y;
		try {
			G$1(b$1);
			for (v$1 = h(r$1); null !== v$1 && (!(v$1.expirationTime > b$1) || a && !M$2());) {
				var d = v$1.callback;
				if ("function" === typeof d) {
					v$1.callback = null;
					y = v$1.priorityLevel;
					var e = d(v$1.expirationTime <= b$1);
					b$1 = exports.unstable_now();
					"function" === typeof e ? v$1.callback = e : v$1 === h(r$1) && k$1(r$1);
					G$1(b$1);
				} else k$1(r$1);
				v$1 = h(r$1);
			}
			if (null !== v$1) var w$1 = !0;
			else {
				var m$2 = h(t);
				null !== m$2 && K$1(H$2, m$2.startTime - b$1);
				w$1 = !1;
			}
			return w$1;
		} finally {
			v$1 = null, y = c, z$2 = !1;
		}
	}
	var N$2 = !1, O$2 = null, L$1 = -1, P$1 = 5, Q$1 = -1;
	function M$2() {
		return exports.unstable_now() - Q$1 < P$1 ? !1 : !0;
	}
	function R$1() {
		if (null !== O$2) {
			var a = exports.unstable_now();
			Q$1 = a;
			var b$1 = !0;
			try {
				b$1 = O$2(!0, a);
			} finally {
				b$1 ? S$1() : (N$2 = !1, O$2 = null);
			}
		} else N$2 = !1;
	}
	var S$1;
	if ("function" === typeof F) S$1 = function() {
		F(R$1);
	};
	else if ("undefined" !== typeof MessageChannel) {
		var T$1 = new MessageChannel(), U$2 = T$1.port2;
		T$1.port1.onmessage = R$1;
		S$1 = function() {
			U$2.postMessage(null);
		};
	} else S$1 = function() {
		D$1(R$1, 0);
	};
	function I$2(a) {
		O$2 = a;
		N$2 || (N$2 = !0, S$1());
	}
	function K$1(a, b$1) {
		L$1 = D$1(function() {
			a(exports.unstable_now());
		}, b$1);
	}
	exports.unstable_IdlePriority = 5;
	exports.unstable_ImmediatePriority = 1;
	exports.unstable_LowPriority = 4;
	exports.unstable_NormalPriority = 3;
	exports.unstable_Profiling = null;
	exports.unstable_UserBlockingPriority = 2;
	exports.unstable_cancelCallback = function(a) {
		a.callback = null;
	};
	exports.unstable_continueExecution = function() {
		A$1 || z$2 || (A$1 = !0, I$2(J$1));
	};
	exports.unstable_forceFrameRate = function(a) {
		0 > a || 125 < a ? console.error("forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported") : P$1 = 0 < a ? Math.floor(1e3 / a) : 5;
	};
	exports.unstable_getCurrentPriorityLevel = function() {
		return y;
	};
	exports.unstable_getFirstCallbackNode = function() {
		return h(r$1);
	};
	exports.unstable_next = function(a) {
		switch (y) {
			case 1:
			case 2:
			case 3:
				var b$1 = 3;
				break;
			default: b$1 = y;
		}
		var c = y;
		y = b$1;
		try {
			return a();
		} finally {
			y = c;
		}
	};
	exports.unstable_pauseExecution = function() {};
	exports.unstable_requestPaint = function() {};
	exports.unstable_runWithPriority = function(a, b$1) {
		switch (a) {
			case 1:
			case 2:
			case 3:
			case 4:
			case 5: break;
			default: a = 3;
		}
		var c = y;
		y = a;
		try {
			return b$1();
		} finally {
			y = c;
		}
	};
	exports.unstable_scheduleCallback = function(a, b$1, c) {
		var d = exports.unstable_now();
		"object" === typeof c && null !== c ? (c = c.delay, c = "number" === typeof c && 0 < c ? d + c : d) : c = d;
		switch (a) {
			case 1:
				var e = -1;
				break;
			case 2:
				e = 250;
				break;
			case 5:
				e = 1073741823;
				break;
			case 4:
				e = 1e4;
				break;
			default: e = 5e3;
		}
		e = c + e;
		a = {
			id: u$1++,
			callback: b$1,
			priorityLevel: a,
			startTime: c,
			expirationTime: e,
			sortIndex: -1
		};
		c > d ? (a.sortIndex = c, f$1(t, a), null === h(r$1) && a === h(t) && (B$1 ? (E$2(L$1), L$1 = -1) : B$1 = !0, K$1(H$2, c - d))) : (a.sortIndex = e, f$1(r$1, a), A$1 || z$2 || (A$1 = !0, I$2(J$1)));
		return a;
	};
	exports.unstable_shouldYield = M$2;
	exports.unstable_wrapCallback = function(a) {
		var b$1 = y;
		return function() {
			var c = y;
			y = b$1;
			try {
				return a.apply(this, arguments);
			} finally {
				y = c;
			}
		};
	};
}));
var require_scheduler = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = require_scheduler_production_min();
}));
/**
* @license React
* react-dom.production.min.js
*
* Copyright (c) Facebook, Inc. and its affiliates.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*/
var require_react_dom_production_min = /* @__PURE__ */ __commonJSMin(((exports) => {
	var aa = require_react(), ca = require_scheduler();
	function p$1(a) {
		for (var b$1 = "https://reactjs.org/docs/error-decoder.html?invariant=" + a, c = 1; c < arguments.length; c++) b$1 += "&args[]=" + encodeURIComponent(arguments[c]);
		return "Minified React error #" + a + "; visit " + b$1 + " for the full message or use the non-minified dev environment for full errors and additional helpful warnings.";
	}
	var da = /* @__PURE__ */ new Set(), ea = {};
	function fa(a, b$1) {
		ha(a, b$1);
		ha(a + "Capture", b$1);
	}
	function ha(a, b$1) {
		ea[a] = b$1;
		for (a = 0; a < b$1.length; a++) da.add(b$1[a]);
	}
	var ia = !("undefined" === typeof window || "undefined" === typeof window.document || "undefined" === typeof window.document.createElement), ja = Object.prototype.hasOwnProperty, ka = /^[:A-Z_a-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD][:A-Z_a-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\-.0-9\u00B7\u0300-\u036F\u203F-\u2040]*$/, la = {}, ma = {};
	function oa(a) {
		if (ja.call(ma, a)) return !0;
		if (ja.call(la, a)) return !1;
		if (ka.test(a)) return ma[a] = !0;
		la[a] = !0;
		return !1;
	}
	function pa(a, b$1, c, d) {
		if (null !== c && 0 === c.type) return !1;
		switch (typeof b$1) {
			case "function":
			case "symbol": return !0;
			case "boolean":
				if (d) return !1;
				if (null !== c) return !c.acceptsBooleans;
				a = a.toLowerCase().slice(0, 5);
				return "data-" !== a && "aria-" !== a;
			default: return !1;
		}
	}
	function qa(a, b$1, c, d) {
		if (null === b$1 || "undefined" === typeof b$1 || pa(a, b$1, c, d)) return !0;
		if (d) return !1;
		if (null !== c) switch (c.type) {
			case 3: return !b$1;
			case 4: return !1 === b$1;
			case 5: return isNaN(b$1);
			case 6: return isNaN(b$1) || 1 > b$1;
		}
		return !1;
	}
	function v(a, b$1, c, d, e, f$2, g$2) {
		this.acceptsBooleans = 2 === b$1 || 3 === b$1 || 4 === b$1;
		this.attributeName = d;
		this.attributeNamespace = e;
		this.mustUseProperty = c;
		this.propertyName = a;
		this.type = b$1;
		this.sanitizeURL = f$2;
		this.removeEmptyString = g$2;
	}
	var z$1 = {};
	"children dangerouslySetInnerHTML defaultValue defaultChecked innerHTML suppressContentEditableWarning suppressHydrationWarning style".split(" ").forEach(function(a) {
		z$1[a] = new v(a, 0, !1, a, null, !1, !1);
	});
	[
		["acceptCharset", "accept-charset"],
		["className", "class"],
		["htmlFor", "for"],
		["httpEquiv", "http-equiv"]
	].forEach(function(a) {
		var b$1 = a[0];
		z$1[b$1] = new v(b$1, 1, !1, a[1], null, !1, !1);
	});
	[
		"contentEditable",
		"draggable",
		"spellCheck",
		"value"
	].forEach(function(a) {
		z$1[a] = new v(a, 2, !1, a.toLowerCase(), null, !1, !1);
	});
	[
		"autoReverse",
		"externalResourcesRequired",
		"focusable",
		"preserveAlpha"
	].forEach(function(a) {
		z$1[a] = new v(a, 2, !1, a, null, !1, !1);
	});
	"allowFullScreen async autoFocus autoPlay controls default defer disabled disablePictureInPicture disableRemotePlayback formNoValidate hidden loop noModule noValidate open playsInline readOnly required reversed scoped seamless itemScope".split(" ").forEach(function(a) {
		z$1[a] = new v(a, 3, !1, a.toLowerCase(), null, !1, !1);
	});
	[
		"checked",
		"multiple",
		"muted",
		"selected"
	].forEach(function(a) {
		z$1[a] = new v(a, 3, !0, a, null, !1, !1);
	});
	["capture", "download"].forEach(function(a) {
		z$1[a] = new v(a, 4, !1, a, null, !1, !1);
	});
	[
		"cols",
		"rows",
		"size",
		"span"
	].forEach(function(a) {
		z$1[a] = new v(a, 6, !1, a, null, !1, !1);
	});
	["rowSpan", "start"].forEach(function(a) {
		z$1[a] = new v(a, 5, !1, a.toLowerCase(), null, !1, !1);
	});
	var ra = /[\-:]([a-z])/g;
	function sa(a) {
		return a[1].toUpperCase();
	}
	"accent-height alignment-baseline arabic-form baseline-shift cap-height clip-path clip-rule color-interpolation color-interpolation-filters color-profile color-rendering dominant-baseline enable-background fill-opacity fill-rule flood-color flood-opacity font-family font-size font-size-adjust font-stretch font-style font-variant font-weight glyph-name glyph-orientation-horizontal glyph-orientation-vertical horiz-adv-x horiz-origin-x image-rendering letter-spacing lighting-color marker-end marker-mid marker-start overline-position overline-thickness paint-order panose-1 pointer-events rendering-intent shape-rendering stop-color stop-opacity strikethrough-position strikethrough-thickness stroke-dasharray stroke-dashoffset stroke-linecap stroke-linejoin stroke-miterlimit stroke-opacity stroke-width text-anchor text-decoration text-rendering underline-position underline-thickness unicode-bidi unicode-range units-per-em v-alphabetic v-hanging v-ideographic v-mathematical vector-effect vert-adv-y vert-origin-x vert-origin-y word-spacing writing-mode xmlns:xlink x-height".split(" ").forEach(function(a) {
		var b$1 = a.replace(ra, sa);
		z$1[b$1] = new v(b$1, 1, !1, a, null, !1, !1);
	});
	"xlink:actuate xlink:arcrole xlink:role xlink:show xlink:title xlink:type".split(" ").forEach(function(a) {
		var b$1 = a.replace(ra, sa);
		z$1[b$1] = new v(b$1, 1, !1, a, "http://www.w3.org/1999/xlink", !1, !1);
	});
	[
		"xml:base",
		"xml:lang",
		"xml:space"
	].forEach(function(a) {
		var b$1 = a.replace(ra, sa);
		z$1[b$1] = new v(b$1, 1, !1, a, "http://www.w3.org/XML/1998/namespace", !1, !1);
	});
	["tabIndex", "crossOrigin"].forEach(function(a) {
		z$1[a] = new v(a, 1, !1, a.toLowerCase(), null, !1, !1);
	});
	z$1.xlinkHref = new v("xlinkHref", 1, !1, "xlink:href", "http://www.w3.org/1999/xlink", !0, !1);
	[
		"src",
		"href",
		"action",
		"formAction"
	].forEach(function(a) {
		z$1[a] = new v(a, 1, !1, a.toLowerCase(), null, !0, !0);
	});
	function ta(a, b$1, c, d) {
		var e = z$1.hasOwnProperty(b$1) ? z$1[b$1] : null;
		if (null !== e ? 0 !== e.type : d || !(2 < b$1.length) || "o" !== b$1[0] && "O" !== b$1[0] || "n" !== b$1[1] && "N" !== b$1[1]) qa(b$1, c, e, d) && (c = null), d || null === e ? oa(b$1) && (null === c ? a.removeAttribute(b$1) : a.setAttribute(b$1, "" + c)) : e.mustUseProperty ? a[e.propertyName] = null === c ? 3 === e.type ? !1 : "" : c : (b$1 = e.attributeName, d = e.attributeNamespace, null === c ? a.removeAttribute(b$1) : (e = e.type, c = 3 === e || 4 === e && !0 === c ? "" : "" + c, d ? a.setAttributeNS(d, b$1, c) : a.setAttribute(b$1, c)));
	}
	var ua = aa.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED, va = Symbol.for("react.element"), wa = Symbol.for("react.portal"), ya = Symbol.for("react.fragment"), za = Symbol.for("react.strict_mode"), Aa = Symbol.for("react.profiler"), Ba = Symbol.for("react.provider"), Ca = Symbol.for("react.context"), Da = Symbol.for("react.forward_ref"), Ea = Symbol.for("react.suspense"), Fa = Symbol.for("react.suspense_list"), Ga = Symbol.for("react.memo"), Ha = Symbol.for("react.lazy");
	var Ia = Symbol.for("react.offscreen");
	var Ja = Symbol.iterator;
	function Ka(a) {
		if (null === a || "object" !== typeof a) return null;
		a = Ja && a[Ja] || a["@@iterator"];
		return "function" === typeof a ? a : null;
	}
	var A = Object.assign, La;
	function Ma(a) {
		if (void 0 === La) try {
			throw Error();
		} catch (c) {
			var b$1 = c.stack.trim().match(/\n( *(at )?)/);
			La = b$1 && b$1[1] || "";
		}
		return "\n" + La + a;
	}
	var Na = !1;
	function Oa(a, b$1) {
		if (!a || Na) return "";
		Na = !0;
		var c = Error.prepareStackTrace;
		Error.prepareStackTrace = void 0;
		try {
			if (b$1) if (b$1 = function() {
				throw Error();
			}, Object.defineProperty(b$1.prototype, "props", { set: function() {
				throw Error();
			} }), "object" === typeof Reflect && Reflect.construct) {
				try {
					Reflect.construct(b$1, []);
				} catch (l$3) {
					var d = l$3;
				}
				Reflect.construct(a, [], b$1);
			} else {
				try {
					b$1.call();
				} catch (l$3) {
					d = l$3;
				}
				a.call(b$1.prototype);
			}
			else {
				try {
					throw Error();
				} catch (l$3) {
					d = l$3;
				}
				a();
			}
		} catch (l$3) {
			if (l$3 && d && "string" === typeof l$3.stack) {
				for (var e = l$3.stack.split("\n"), f$2 = d.stack.split("\n"), g$2 = e.length - 1, h$1 = f$2.length - 1; 1 <= g$2 && 0 <= h$1 && e[g$2] !== f$2[h$1];) h$1--;
				for (; 1 <= g$2 && 0 <= h$1; g$2--, h$1--) if (e[g$2] !== f$2[h$1]) {
					if (1 !== g$2 || 1 !== h$1) do
						if (g$2--, h$1--, 0 > h$1 || e[g$2] !== f$2[h$1]) {
							var k$2 = "\n" + e[g$2].replace(" at new ", " at ");
							a.displayName && k$2.includes("<anonymous>") && (k$2 = k$2.replace("<anonymous>", a.displayName));
							return k$2;
						}
					while (1 <= g$2 && 0 <= h$1);
					break;
				}
			}
		} finally {
			Na = !1, Error.prepareStackTrace = c;
		}
		return (a = a ? a.displayName || a.name : "") ? Ma(a) : "";
	}
	function Pa(a) {
		switch (a.tag) {
			case 5: return Ma(a.type);
			case 16: return Ma("Lazy");
			case 13: return Ma("Suspense");
			case 19: return Ma("SuspenseList");
			case 0:
			case 2:
			case 15: return a = Oa(a.type, !1), a;
			case 11: return a = Oa(a.type.render, !1), a;
			case 1: return a = Oa(a.type, !0), a;
			default: return "";
		}
	}
	function Qa(a) {
		if (null == a) return null;
		if ("function" === typeof a) return a.displayName || a.name || null;
		if ("string" === typeof a) return a;
		switch (a) {
			case ya: return "Fragment";
			case wa: return "Portal";
			case Aa: return "Profiler";
			case za: return "StrictMode";
			case Ea: return "Suspense";
			case Fa: return "SuspenseList";
		}
		if ("object" === typeof a) switch (a.$$typeof) {
			case Ca: return (a.displayName || "Context") + ".Consumer";
			case Ba: return (a._context.displayName || "Context") + ".Provider";
			case Da:
				var b$1 = a.render;
				a = a.displayName;
				a || (a = b$1.displayName || b$1.name || "", a = "" !== a ? "ForwardRef(" + a + ")" : "ForwardRef");
				return a;
			case Ga: return b$1 = a.displayName || null, null !== b$1 ? b$1 : Qa(a.type) || "Memo";
			case Ha:
				b$1 = a._payload;
				a = a._init;
				try {
					return Qa(a(b$1));
				} catch (c) {}
		}
		return null;
	}
	function Ra(a) {
		var b$1 = a.type;
		switch (a.tag) {
			case 24: return "Cache";
			case 9: return (b$1.displayName || "Context") + ".Consumer";
			case 10: return (b$1._context.displayName || "Context") + ".Provider";
			case 18: return "DehydratedFragment";
			case 11: return a = b$1.render, a = a.displayName || a.name || "", b$1.displayName || ("" !== a ? "ForwardRef(" + a + ")" : "ForwardRef");
			case 7: return "Fragment";
			case 5: return b$1;
			case 4: return "Portal";
			case 3: return "Root";
			case 6: return "Text";
			case 16: return Qa(b$1);
			case 8: return b$1 === za ? "StrictMode" : "Mode";
			case 22: return "Offscreen";
			case 12: return "Profiler";
			case 21: return "Scope";
			case 13: return "Suspense";
			case 19: return "SuspenseList";
			case 25: return "TracingMarker";
			case 1:
			case 0:
			case 17:
			case 2:
			case 14:
			case 15:
				if ("function" === typeof b$1) return b$1.displayName || b$1.name || null;
				if ("string" === typeof b$1) return b$1;
		}
		return null;
	}
	function Sa(a) {
		switch (typeof a) {
			case "boolean":
			case "number":
			case "string":
			case "undefined": return a;
			case "object": return a;
			default: return "";
		}
	}
	function Ta(a) {
		var b$1 = a.type;
		return (a = a.nodeName) && "input" === a.toLowerCase() && ("checkbox" === b$1 || "radio" === b$1);
	}
	function Ua(a) {
		var b$1 = Ta(a) ? "checked" : "value", c = Object.getOwnPropertyDescriptor(a.constructor.prototype, b$1), d = "" + a[b$1];
		if (!a.hasOwnProperty(b$1) && "undefined" !== typeof c && "function" === typeof c.get && "function" === typeof c.set) {
			var e = c.get, f$2 = c.set;
			Object.defineProperty(a, b$1, {
				configurable: !0,
				get: function() {
					return e.call(this);
				},
				set: function(a$1) {
					d = "" + a$1;
					f$2.call(this, a$1);
				}
			});
			Object.defineProperty(a, b$1, { enumerable: c.enumerable });
			return {
				getValue: function() {
					return d;
				},
				setValue: function(a$1) {
					d = "" + a$1;
				},
				stopTracking: function() {
					a._valueTracker = null;
					delete a[b$1];
				}
			};
		}
	}
	function Va(a) {
		a._valueTracker || (a._valueTracker = Ua(a));
	}
	function Wa(a) {
		if (!a) return !1;
		var b$1 = a._valueTracker;
		if (!b$1) return !0;
		var c = b$1.getValue();
		var d = "";
		a && (d = Ta(a) ? a.checked ? "true" : "false" : a.value);
		a = d;
		return a !== c ? (b$1.setValue(a), !0) : !1;
	}
	function Xa(a) {
		a = a || ("undefined" !== typeof document ? document : void 0);
		if ("undefined" === typeof a) return null;
		try {
			return a.activeElement || a.body;
		} catch (b$1) {
			return a.body;
		}
	}
	function Ya(a, b$1) {
		var c = b$1.checked;
		return A({}, b$1, {
			defaultChecked: void 0,
			defaultValue: void 0,
			value: void 0,
			checked: null != c ? c : a._wrapperState.initialChecked
		});
	}
	function Za(a, b$1) {
		var c = null == b$1.defaultValue ? "" : b$1.defaultValue, d = null != b$1.checked ? b$1.checked : b$1.defaultChecked;
		c = Sa(null != b$1.value ? b$1.value : c);
		a._wrapperState = {
			initialChecked: d,
			initialValue: c,
			controlled: "checkbox" === b$1.type || "radio" === b$1.type ? null != b$1.checked : null != b$1.value
		};
	}
	function ab(a, b$1) {
		b$1 = b$1.checked;
		null != b$1 && ta(a, "checked", b$1, !1);
	}
	function bb(a, b$1) {
		ab(a, b$1);
		var c = Sa(b$1.value), d = b$1.type;
		if (null != c) if ("number" === d) {
			if (0 === c && "" === a.value || a.value != c) a.value = "" + c;
		} else a.value !== "" + c && (a.value = "" + c);
		else if ("submit" === d || "reset" === d) {
			a.removeAttribute("value");
			return;
		}
		b$1.hasOwnProperty("value") ? cb(a, b$1.type, c) : b$1.hasOwnProperty("defaultValue") && cb(a, b$1.type, Sa(b$1.defaultValue));
		null == b$1.checked && null != b$1.defaultChecked && (a.defaultChecked = !!b$1.defaultChecked);
	}
	function db(a, b$1, c) {
		if (b$1.hasOwnProperty("value") || b$1.hasOwnProperty("defaultValue")) {
			var d = b$1.type;
			if (!("submit" !== d && "reset" !== d || void 0 !== b$1.value && null !== b$1.value)) return;
			b$1 = "" + a._wrapperState.initialValue;
			c || b$1 === a.value || (a.value = b$1);
			a.defaultValue = b$1;
		}
		c = a.name;
		"" !== c && (a.name = "");
		a.defaultChecked = !!a._wrapperState.initialChecked;
		"" !== c && (a.name = c);
	}
	function cb(a, b$1, c) {
		if ("number" !== b$1 || Xa(a.ownerDocument) !== a) null == c ? a.defaultValue = "" + a._wrapperState.initialValue : a.defaultValue !== "" + c && (a.defaultValue = "" + c);
	}
	var eb = Array.isArray;
	function fb(a, b$1, c, d) {
		a = a.options;
		if (b$1) {
			b$1 = {};
			for (var e = 0; e < c.length; e++) b$1["$" + c[e]] = !0;
			for (c = 0; c < a.length; c++) e = b$1.hasOwnProperty("$" + a[c].value), a[c].selected !== e && (a[c].selected = e), e && d && (a[c].defaultSelected = !0);
		} else {
			c = "" + Sa(c);
			b$1 = null;
			for (e = 0; e < a.length; e++) {
				if (a[e].value === c) {
					a[e].selected = !0;
					d && (a[e].defaultSelected = !0);
					return;
				}
				null !== b$1 || a[e].disabled || (b$1 = a[e]);
			}
			null !== b$1 && (b$1.selected = !0);
		}
	}
	function gb(a, b$1) {
		if (null != b$1.dangerouslySetInnerHTML) throw Error(p$1(91));
		return A({}, b$1, {
			value: void 0,
			defaultValue: void 0,
			children: "" + a._wrapperState.initialValue
		});
	}
	function hb(a, b$1) {
		var c = b$1.value;
		if (null == c) {
			c = b$1.children;
			b$1 = b$1.defaultValue;
			if (null != c) {
				if (null != b$1) throw Error(p$1(92));
				if (eb(c)) {
					if (1 < c.length) throw Error(p$1(93));
					c = c[0];
				}
				b$1 = c;
			}
			b$1 ??= "";
			c = b$1;
		}
		a._wrapperState = { initialValue: Sa(c) };
	}
	function ib(a, b$1) {
		var c = Sa(b$1.value), d = Sa(b$1.defaultValue);
		null != c && (c = "" + c, c !== a.value && (a.value = c), null == b$1.defaultValue && a.defaultValue !== c && (a.defaultValue = c));
		null != d && (a.defaultValue = "" + d);
	}
	function jb(a) {
		var b$1 = a.textContent;
		b$1 === a._wrapperState.initialValue && "" !== b$1 && null !== b$1 && (a.value = b$1);
	}
	function kb(a) {
		switch (a) {
			case "svg": return "http://www.w3.org/2000/svg";
			case "math": return "http://www.w3.org/1998/Math/MathML";
			default: return "http://www.w3.org/1999/xhtml";
		}
	}
	function lb(a, b$1) {
		return null == a || "http://www.w3.org/1999/xhtml" === a ? kb(b$1) : "http://www.w3.org/2000/svg" === a && "foreignObject" === b$1 ? "http://www.w3.org/1999/xhtml" : a;
	}
	var mb, nb = function(a) {
		return "undefined" !== typeof MSApp && MSApp.execUnsafeLocalFunction ? function(b$1, c, d, e) {
			MSApp.execUnsafeLocalFunction(function() {
				return a(b$1, c, d, e);
			});
		} : a;
	}(function(a, b$1) {
		if ("http://www.w3.org/2000/svg" !== a.namespaceURI || "innerHTML" in a) a.innerHTML = b$1;
		else {
			mb = mb || document.createElement("div");
			mb.innerHTML = "<svg>" + b$1.valueOf().toString() + "</svg>";
			for (b$1 = mb.firstChild; a.firstChild;) a.removeChild(a.firstChild);
			for (; b$1.firstChild;) a.appendChild(b$1.firstChild);
		}
	});
	function ob(a, b$1) {
		if (b$1) {
			var c = a.firstChild;
			if (c && c === a.lastChild && 3 === c.nodeType) {
				c.nodeValue = b$1;
				return;
			}
		}
		a.textContent = b$1;
	}
	var pb = {
		animationIterationCount: !0,
		aspectRatio: !0,
		borderImageOutset: !0,
		borderImageSlice: !0,
		borderImageWidth: !0,
		boxFlex: !0,
		boxFlexGroup: !0,
		boxOrdinalGroup: !0,
		columnCount: !0,
		columns: !0,
		flex: !0,
		flexGrow: !0,
		flexPositive: !0,
		flexShrink: !0,
		flexNegative: !0,
		flexOrder: !0,
		gridArea: !0,
		gridRow: !0,
		gridRowEnd: !0,
		gridRowSpan: !0,
		gridRowStart: !0,
		gridColumn: !0,
		gridColumnEnd: !0,
		gridColumnSpan: !0,
		gridColumnStart: !0,
		fontWeight: !0,
		lineClamp: !0,
		lineHeight: !0,
		opacity: !0,
		order: !0,
		orphans: !0,
		tabSize: !0,
		widows: !0,
		zIndex: !0,
		zoom: !0,
		fillOpacity: !0,
		floodOpacity: !0,
		stopOpacity: !0,
		strokeDasharray: !0,
		strokeDashoffset: !0,
		strokeMiterlimit: !0,
		strokeOpacity: !0,
		strokeWidth: !0
	}, qb = [
		"Webkit",
		"ms",
		"Moz",
		"O"
	];
	Object.keys(pb).forEach(function(a) {
		qb.forEach(function(b$1) {
			b$1 = b$1 + a.charAt(0).toUpperCase() + a.substring(1);
			pb[b$1] = pb[a];
		});
	});
	function rb(a, b$1, c) {
		return null == b$1 || "boolean" === typeof b$1 || "" === b$1 ? "" : c || "number" !== typeof b$1 || 0 === b$1 || pb.hasOwnProperty(a) && pb[a] ? ("" + b$1).trim() : b$1 + "px";
	}
	function sb(a, b$1) {
		a = a.style;
		for (var c in b$1) if (b$1.hasOwnProperty(c)) {
			var d = 0 === c.indexOf("--"), e = rb(c, b$1[c], d);
			"float" === c && (c = "cssFloat");
			d ? a.setProperty(c, e) : a[c] = e;
		}
	}
	var tb = A({ menuitem: !0 }, {
		area: !0,
		base: !0,
		br: !0,
		col: !0,
		embed: !0,
		hr: !0,
		img: !0,
		input: !0,
		keygen: !0,
		link: !0,
		meta: !0,
		param: !0,
		source: !0,
		track: !0,
		wbr: !0
	});
	function ub(a, b$1) {
		if (b$1) {
			if (tb[a] && (null != b$1.children || null != b$1.dangerouslySetInnerHTML)) throw Error(p$1(137, a));
			if (null != b$1.dangerouslySetInnerHTML) {
				if (null != b$1.children) throw Error(p$1(60));
				if ("object" !== typeof b$1.dangerouslySetInnerHTML || !("__html" in b$1.dangerouslySetInnerHTML)) throw Error(p$1(61));
			}
			if (null != b$1.style && "object" !== typeof b$1.style) throw Error(p$1(62));
		}
	}
	function vb(a, b$1) {
		if (-1 === a.indexOf("-")) return "string" === typeof b$1.is;
		switch (a) {
			case "annotation-xml":
			case "color-profile":
			case "font-face":
			case "font-face-src":
			case "font-face-uri":
			case "font-face-format":
			case "font-face-name":
			case "missing-glyph": return !1;
			default: return !0;
		}
	}
	var wb = null;
	function xb(a) {
		a = a.target || a.srcElement || window;
		a.correspondingUseElement && (a = a.correspondingUseElement);
		return 3 === a.nodeType ? a.parentNode : a;
	}
	var yb = null, zb = null, Ab = null;
	function Bb(a) {
		if (a = Cb(a)) {
			if ("function" !== typeof yb) throw Error(p$1(280));
			var b$1 = a.stateNode;
			b$1 && (b$1 = Db(b$1), yb(a.stateNode, a.type, b$1));
		}
	}
	function Eb(a) {
		zb ? Ab ? Ab.push(a) : Ab = [a] : zb = a;
	}
	function Fb() {
		if (zb) {
			var a = zb, b$1 = Ab;
			Ab = zb = null;
			Bb(a);
			if (b$1) for (a = 0; a < b$1.length; a++) Bb(b$1[a]);
		}
	}
	function Gb(a, b$1) {
		return a(b$1);
	}
	function Hb() {}
	var Ib = !1;
	function Jb(a, b$1, c) {
		if (Ib) return a(b$1, c);
		Ib = !0;
		try {
			return Gb(a, b$1, c);
		} finally {
			if (Ib = !1, null !== zb || null !== Ab) Hb(), Fb();
		}
	}
	function Kb(a, b$1) {
		var c = a.stateNode;
		if (null === c) return null;
		var d = Db(c);
		if (null === d) return null;
		c = d[b$1];
		a: switch (b$1) {
			case "onClick":
			case "onClickCapture":
			case "onDoubleClick":
			case "onDoubleClickCapture":
			case "onMouseDown":
			case "onMouseDownCapture":
			case "onMouseMove":
			case "onMouseMoveCapture":
			case "onMouseUp":
			case "onMouseUpCapture":
			case "onMouseEnter":
				(d = !d.disabled) || (a = a.type, d = !("button" === a || "input" === a || "select" === a || "textarea" === a));
				a = !d;
				break a;
			default: a = !1;
		}
		if (a) return null;
		if (c && "function" !== typeof c) throw Error(p$1(231, b$1, typeof c));
		return c;
	}
	var Lb = !1;
	if (ia) try {
		var Mb = {};
		Object.defineProperty(Mb, "passive", { get: function() {
			Lb = !0;
		} });
		window.addEventListener("test", Mb, Mb);
		window.removeEventListener("test", Mb, Mb);
	} catch (a) {
		Lb = !1;
	}
	function Nb(a, b$1, c, d, e, f$2, g$2, h$1, k$2) {
		var l$3 = Array.prototype.slice.call(arguments, 3);
		try {
			b$1.apply(c, l$3);
		} catch (m$2) {
			this.onError(m$2);
		}
	}
	var Ob = !1, Pb = null, Qb = !1, Rb = null, Sb = { onError: function(a) {
		Ob = !0;
		Pb = a;
	} };
	function Tb(a, b$1, c, d, e, f$2, g$2, h$1, k$2) {
		Ob = !1;
		Pb = null;
		Nb.apply(Sb, arguments);
	}
	function Ub(a, b$1, c, d, e, f$2, g$2, h$1, k$2) {
		Tb.apply(this, arguments);
		if (Ob) {
			if (Ob) {
				var l$3 = Pb;
				Ob = !1;
				Pb = null;
			} else throw Error(p$1(198));
			Qb || (Qb = !0, Rb = l$3);
		}
	}
	function Vb(a) {
		var b$1 = a, c = a;
		if (a.alternate) for (; b$1.return;) b$1 = b$1.return;
		else {
			a = b$1;
			do
				b$1 = a, 0 !== (b$1.flags & 4098) && (c = b$1.return), a = b$1.return;
			while (a);
		}
		return 3 === b$1.tag ? c : null;
	}
	function Wb(a) {
		if (13 === a.tag) {
			var b$1 = a.memoizedState;
			null === b$1 && (a = a.alternate, null !== a && (b$1 = a.memoizedState));
			if (null !== b$1) return b$1.dehydrated;
		}
		return null;
	}
	function Xb(a) {
		if (Vb(a) !== a) throw Error(p$1(188));
	}
	function Yb(a) {
		var b$1 = a.alternate;
		if (!b$1) {
			b$1 = Vb(a);
			if (null === b$1) throw Error(p$1(188));
			return b$1 !== a ? null : a;
		}
		for (var c = a, d = b$1;;) {
			var e = c.return;
			if (null === e) break;
			var f$2 = e.alternate;
			if (null === f$2) {
				d = e.return;
				if (null !== d) {
					c = d;
					continue;
				}
				break;
			}
			if (e.child === f$2.child) {
				for (f$2 = e.child; f$2;) {
					if (f$2 === c) return Xb(e), a;
					if (f$2 === d) return Xb(e), b$1;
					f$2 = f$2.sibling;
				}
				throw Error(p$1(188));
			}
			if (c.return !== d.return) c = e, d = f$2;
			else {
				for (var g$2 = !1, h$1 = e.child; h$1;) {
					if (h$1 === c) {
						g$2 = !0;
						c = e;
						d = f$2;
						break;
					}
					if (h$1 === d) {
						g$2 = !0;
						d = e;
						c = f$2;
						break;
					}
					h$1 = h$1.sibling;
				}
				if (!g$2) {
					for (h$1 = f$2.child; h$1;) {
						if (h$1 === c) {
							g$2 = !0;
							c = f$2;
							d = e;
							break;
						}
						if (h$1 === d) {
							g$2 = !0;
							d = f$2;
							c = e;
							break;
						}
						h$1 = h$1.sibling;
					}
					if (!g$2) throw Error(p$1(189));
				}
			}
			if (c.alternate !== d) throw Error(p$1(190));
		}
		if (3 !== c.tag) throw Error(p$1(188));
		return c.stateNode.current === c ? a : b$1;
	}
	function Zb(a) {
		a = Yb(a);
		return null !== a ? $b(a) : null;
	}
	function $b(a) {
		if (5 === a.tag || 6 === a.tag) return a;
		for (a = a.child; null !== a;) {
			var b$1 = $b(a);
			if (null !== b$1) return b$1;
			a = a.sibling;
		}
		return null;
	}
	var ac = ca.unstable_scheduleCallback, bc = ca.unstable_cancelCallback, cc = ca.unstable_shouldYield, dc = ca.unstable_requestPaint, B = ca.unstable_now, ec = ca.unstable_getCurrentPriorityLevel, fc = ca.unstable_ImmediatePriority, gc = ca.unstable_UserBlockingPriority, hc = ca.unstable_NormalPriority, ic = ca.unstable_LowPriority, jc = ca.unstable_IdlePriority, kc = null, lc = null;
	function mc(a) {
		if (lc && "function" === typeof lc.onCommitFiberRoot) try {
			lc.onCommitFiberRoot(kc, a, void 0, 128 === (a.current.flags & 128));
		} catch (b$1) {}
	}
	var oc = Math.clz32 ? Math.clz32 : nc, pc = Math.log, qc = Math.LN2;
	function nc(a) {
		a >>>= 0;
		return 0 === a ? 32 : 31 - (pc(a) / qc | 0) | 0;
	}
	var rc = 64, sc = 4194304;
	function tc(a) {
		switch (a & -a) {
			case 1: return 1;
			case 2: return 2;
			case 4: return 4;
			case 8: return 8;
			case 16: return 16;
			case 32: return 32;
			case 64:
			case 128:
			case 256:
			case 512:
			case 1024:
			case 2048:
			case 4096:
			case 8192:
			case 16384:
			case 32768:
			case 65536:
			case 131072:
			case 262144:
			case 524288:
			case 1048576:
			case 2097152: return a & 4194240;
			case 4194304:
			case 8388608:
			case 16777216:
			case 33554432:
			case 67108864: return a & 130023424;
			case 134217728: return 134217728;
			case 268435456: return 268435456;
			case 536870912: return 536870912;
			case 1073741824: return 1073741824;
			default: return a;
		}
	}
	function uc(a, b$1) {
		var c = a.pendingLanes;
		if (0 === c) return 0;
		var d = 0, e = a.suspendedLanes, f$2 = a.pingedLanes, g$2 = c & 268435455;
		if (0 !== g$2) {
			var h$1 = g$2 & ~e;
			0 !== h$1 ? d = tc(h$1) : (f$2 &= g$2, 0 !== f$2 && (d = tc(f$2)));
		} else g$2 = c & ~e, 0 !== g$2 ? d = tc(g$2) : 0 !== f$2 && (d = tc(f$2));
		if (0 === d) return 0;
		if (0 !== b$1 && b$1 !== d && 0 === (b$1 & e) && (e = d & -d, f$2 = b$1 & -b$1, e >= f$2 || 16 === e && 0 !== (f$2 & 4194240))) return b$1;
		0 !== (d & 4) && (d |= c & 16);
		b$1 = a.entangledLanes;
		if (0 !== b$1) for (a = a.entanglements, b$1 &= d; 0 < b$1;) c = 31 - oc(b$1), e = 1 << c, d |= a[c], b$1 &= ~e;
		return d;
	}
	function vc(a, b$1) {
		switch (a) {
			case 1:
			case 2:
			case 4: return b$1 + 250;
			case 8:
			case 16:
			case 32:
			case 64:
			case 128:
			case 256:
			case 512:
			case 1024:
			case 2048:
			case 4096:
			case 8192:
			case 16384:
			case 32768:
			case 65536:
			case 131072:
			case 262144:
			case 524288:
			case 1048576:
			case 2097152: return b$1 + 5e3;
			case 4194304:
			case 8388608:
			case 16777216:
			case 33554432:
			case 67108864: return -1;
			case 134217728:
			case 268435456:
			case 536870912:
			case 1073741824: return -1;
			default: return -1;
		}
	}
	function wc(a, b$1) {
		for (var c = a.suspendedLanes, d = a.pingedLanes, e = a.expirationTimes, f$2 = a.pendingLanes; 0 < f$2;) {
			var g$2 = 31 - oc(f$2), h$1 = 1 << g$2, k$2 = e[g$2];
			if (-1 === k$2) {
				if (0 === (h$1 & c) || 0 !== (h$1 & d)) e[g$2] = vc(h$1, b$1);
			} else k$2 <= b$1 && (a.expiredLanes |= h$1);
			f$2 &= ~h$1;
		}
	}
	function xc(a) {
		a = a.pendingLanes & -1073741825;
		return 0 !== a ? a : a & 1073741824 ? 1073741824 : 0;
	}
	function yc() {
		var a = rc;
		rc <<= 1;
		0 === (rc & 4194240) && (rc = 64);
		return a;
	}
	function zc(a) {
		for (var b$1 = [], c = 0; 31 > c; c++) b$1.push(a);
		return b$1;
	}
	function Ac(a, b$1, c) {
		a.pendingLanes |= b$1;
		536870912 !== b$1 && (a.suspendedLanes = 0, a.pingedLanes = 0);
		a = a.eventTimes;
		b$1 = 31 - oc(b$1);
		a[b$1] = c;
	}
	function Bc(a, b$1) {
		var c = a.pendingLanes & ~b$1;
		a.pendingLanes = b$1;
		a.suspendedLanes = 0;
		a.pingedLanes = 0;
		a.expiredLanes &= b$1;
		a.mutableReadLanes &= b$1;
		a.entangledLanes &= b$1;
		b$1 = a.entanglements;
		var d = a.eventTimes;
		for (a = a.expirationTimes; 0 < c;) {
			var e = 31 - oc(c), f$2 = 1 << e;
			b$1[e] = 0;
			d[e] = -1;
			a[e] = -1;
			c &= ~f$2;
		}
	}
	function Cc(a, b$1) {
		var c = a.entangledLanes |= b$1;
		for (a = a.entanglements; c;) {
			var d = 31 - oc(c), e = 1 << d;
			e & b$1 | a[d] & b$1 && (a[d] |= b$1);
			c &= ~e;
		}
	}
	var C = 0;
	function Dc(a) {
		a &= -a;
		return 1 < a ? 4 < a ? 0 !== (a & 268435455) ? 16 : 536870912 : 4 : 1;
	}
	var Ec, Fc, Gc, Hc, Ic, Jc = !1, Kc = [], Lc = null, Mc = null, Nc = null, Oc = /* @__PURE__ */ new Map(), Pc = /* @__PURE__ */ new Map(), Qc = [], Rc = "mousedown mouseup touchcancel touchend touchstart auxclick dblclick pointercancel pointerdown pointerup dragend dragstart drop compositionend compositionstart keydown keypress keyup input textInput copy cut paste click change contextmenu reset submit".split(" ");
	function Sc(a, b$1) {
		switch (a) {
			case "focusin":
			case "focusout":
				Lc = null;
				break;
			case "dragenter":
			case "dragleave":
				Mc = null;
				break;
			case "mouseover":
			case "mouseout":
				Nc = null;
				break;
			case "pointerover":
			case "pointerout":
				Oc.delete(b$1.pointerId);
				break;
			case "gotpointercapture":
			case "lostpointercapture": Pc.delete(b$1.pointerId);
		}
	}
	function Tc(a, b$1, c, d, e, f$2) {
		if (null === a || a.nativeEvent !== f$2) return a = {
			blockedOn: b$1,
			domEventName: c,
			eventSystemFlags: d,
			nativeEvent: f$2,
			targetContainers: [e]
		}, null !== b$1 && (b$1 = Cb(b$1), null !== b$1 && Fc(b$1)), a;
		a.eventSystemFlags |= d;
		b$1 = a.targetContainers;
		null !== e && -1 === b$1.indexOf(e) && b$1.push(e);
		return a;
	}
	function Uc(a, b$1, c, d, e) {
		switch (b$1) {
			case "focusin": return Lc = Tc(Lc, a, b$1, c, d, e), !0;
			case "dragenter": return Mc = Tc(Mc, a, b$1, c, d, e), !0;
			case "mouseover": return Nc = Tc(Nc, a, b$1, c, d, e), !0;
			case "pointerover":
				var f$2 = e.pointerId;
				Oc.set(f$2, Tc(Oc.get(f$2) || null, a, b$1, c, d, e));
				return !0;
			case "gotpointercapture": return f$2 = e.pointerId, Pc.set(f$2, Tc(Pc.get(f$2) || null, a, b$1, c, d, e)), !0;
		}
		return !1;
	}
	function Vc(a) {
		var b$1 = Wc(a.target);
		if (null !== b$1) {
			var c = Vb(b$1);
			if (null !== c) {
				if (b$1 = c.tag, 13 === b$1) {
					if (b$1 = Wb(c), null !== b$1) {
						a.blockedOn = b$1;
						Ic(a.priority, function() {
							Gc(c);
						});
						return;
					}
				} else if (3 === b$1 && c.stateNode.current.memoizedState.isDehydrated) {
					a.blockedOn = 3 === c.tag ? c.stateNode.containerInfo : null;
					return;
				}
			}
		}
		a.blockedOn = null;
	}
	function Xc(a) {
		if (null !== a.blockedOn) return !1;
		for (var b$1 = a.targetContainers; 0 < b$1.length;) {
			var c = Yc(a.domEventName, a.eventSystemFlags, b$1[0], a.nativeEvent);
			if (null === c) {
				c = a.nativeEvent;
				var d = new c.constructor(c.type, c);
				wb = d;
				c.target.dispatchEvent(d);
				wb = null;
			} else return b$1 = Cb(c), null !== b$1 && Fc(b$1), a.blockedOn = c, !1;
			b$1.shift();
		}
		return !0;
	}
	function Zc(a, b$1, c) {
		Xc(a) && c.delete(b$1);
	}
	function $c() {
		Jc = !1;
		null !== Lc && Xc(Lc) && (Lc = null);
		null !== Mc && Xc(Mc) && (Mc = null);
		null !== Nc && Xc(Nc) && (Nc = null);
		Oc.forEach(Zc);
		Pc.forEach(Zc);
	}
	function ad(a, b$1) {
		a.blockedOn === b$1 && (a.blockedOn = null, Jc || (Jc = !0, ca.unstable_scheduleCallback(ca.unstable_NormalPriority, $c)));
	}
	function bd(a) {
		function b$1(b$2) {
			return ad(b$2, a);
		}
		if (0 < Kc.length) {
			ad(Kc[0], a);
			for (var c = 1; c < Kc.length; c++) {
				var d = Kc[c];
				d.blockedOn === a && (d.blockedOn = null);
			}
		}
		null !== Lc && ad(Lc, a);
		null !== Mc && ad(Mc, a);
		null !== Nc && ad(Nc, a);
		Oc.forEach(b$1);
		Pc.forEach(b$1);
		for (c = 0; c < Qc.length; c++) d = Qc[c], d.blockedOn === a && (d.blockedOn = null);
		for (; 0 < Qc.length && (c = Qc[0], null === c.blockedOn);) Vc(c), null === c.blockedOn && Qc.shift();
	}
	var cd = ua.ReactCurrentBatchConfig, dd = !0;
	function ed(a, b$1, c, d) {
		var e = C, f$2 = cd.transition;
		cd.transition = null;
		try {
			C = 1, fd(a, b$1, c, d);
		} finally {
			C = e, cd.transition = f$2;
		}
	}
	function gd(a, b$1, c, d) {
		var e = C, f$2 = cd.transition;
		cd.transition = null;
		try {
			C = 4, fd(a, b$1, c, d);
		} finally {
			C = e, cd.transition = f$2;
		}
	}
	function fd(a, b$1, c, d) {
		if (dd) {
			var e = Yc(a, b$1, c, d);
			if (null === e) hd(a, b$1, d, id, c), Sc(a, d);
			else if (Uc(e, a, b$1, c, d)) d.stopPropagation();
			else if (Sc(a, d), b$1 & 4 && -1 < Rc.indexOf(a)) {
				for (; null !== e;) {
					var f$2 = Cb(e);
					null !== f$2 && Ec(f$2);
					f$2 = Yc(a, b$1, c, d);
					null === f$2 && hd(a, b$1, d, id, c);
					if (f$2 === e) break;
					e = f$2;
				}
				null !== e && d.stopPropagation();
			} else hd(a, b$1, d, null, c);
		}
	}
	var id = null;
	function Yc(a, b$1, c, d) {
		id = null;
		a = xb(d);
		a = Wc(a);
		if (null !== a) if (b$1 = Vb(a), null === b$1) a = null;
		else if (c = b$1.tag, 13 === c) {
			a = Wb(b$1);
			if (null !== a) return a;
			a = null;
		} else if (3 === c) {
			if (b$1.stateNode.current.memoizedState.isDehydrated) return 3 === b$1.tag ? b$1.stateNode.containerInfo : null;
			a = null;
		} else b$1 !== a && (a = null);
		id = a;
		return null;
	}
	function jd(a) {
		switch (a) {
			case "cancel":
			case "click":
			case "close":
			case "contextmenu":
			case "copy":
			case "cut":
			case "auxclick":
			case "dblclick":
			case "dragend":
			case "dragstart":
			case "drop":
			case "focusin":
			case "focusout":
			case "input":
			case "invalid":
			case "keydown":
			case "keypress":
			case "keyup":
			case "mousedown":
			case "mouseup":
			case "paste":
			case "pause":
			case "play":
			case "pointercancel":
			case "pointerdown":
			case "pointerup":
			case "ratechange":
			case "reset":
			case "resize":
			case "seeked":
			case "submit":
			case "touchcancel":
			case "touchend":
			case "touchstart":
			case "volumechange":
			case "change":
			case "selectionchange":
			case "textInput":
			case "compositionstart":
			case "compositionend":
			case "compositionupdate":
			case "beforeblur":
			case "afterblur":
			case "beforeinput":
			case "blur":
			case "fullscreenchange":
			case "focus":
			case "hashchange":
			case "popstate":
			case "select":
			case "selectstart": return 1;
			case "drag":
			case "dragenter":
			case "dragexit":
			case "dragleave":
			case "dragover":
			case "mousemove":
			case "mouseout":
			case "mouseover":
			case "pointermove":
			case "pointerout":
			case "pointerover":
			case "scroll":
			case "toggle":
			case "touchmove":
			case "wheel":
			case "mouseenter":
			case "mouseleave":
			case "pointerenter":
			case "pointerleave": return 4;
			case "message": switch (ec()) {
				case fc: return 1;
				case gc: return 4;
				case hc:
				case ic: return 16;
				case jc: return 536870912;
				default: return 16;
			}
			default: return 16;
		}
	}
	var kd = null, ld = null, md = null;
	function nd() {
		if (md) return md;
		var a, b$1 = ld, c = b$1.length, d, e = "value" in kd ? kd.value : kd.textContent, f$2 = e.length;
		for (a = 0; a < c && b$1[a] === e[a]; a++);
		var g$2 = c - a;
		for (d = 1; d <= g$2 && b$1[c - d] === e[f$2 - d]; d++);
		return md = e.slice(a, 1 < d ? 1 - d : void 0);
	}
	function od(a) {
		var b$1 = a.keyCode;
		"charCode" in a ? (a = a.charCode, 0 === a && 13 === b$1 && (a = 13)) : a = b$1;
		10 === a && (a = 13);
		return 32 <= a || 13 === a ? a : 0;
	}
	function pd() {
		return !0;
	}
	function qd() {
		return !1;
	}
	function rd(a) {
		function b$1(b$2, d, e, f$2, g$2) {
			this._reactName = b$2;
			this._targetInst = e;
			this.type = d;
			this.nativeEvent = f$2;
			this.target = g$2;
			this.currentTarget = null;
			for (var c in a) a.hasOwnProperty(c) && (b$2 = a[c], this[c] = b$2 ? b$2(f$2) : f$2[c]);
			this.isDefaultPrevented = (null != f$2.defaultPrevented ? f$2.defaultPrevented : !1 === f$2.returnValue) ? pd : qd;
			this.isPropagationStopped = qd;
			return this;
		}
		A(b$1.prototype, {
			preventDefault: function() {
				this.defaultPrevented = !0;
				var a$1 = this.nativeEvent;
				a$1 && (a$1.preventDefault ? a$1.preventDefault() : "unknown" !== typeof a$1.returnValue && (a$1.returnValue = !1), this.isDefaultPrevented = pd);
			},
			stopPropagation: function() {
				var a$1 = this.nativeEvent;
				a$1 && (a$1.stopPropagation ? a$1.stopPropagation() : "unknown" !== typeof a$1.cancelBubble && (a$1.cancelBubble = !0), this.isPropagationStopped = pd);
			},
			persist: function() {},
			isPersistent: pd
		});
		return b$1;
	}
	var sd = {
		eventPhase: 0,
		bubbles: 0,
		cancelable: 0,
		timeStamp: function(a) {
			return a.timeStamp || Date.now();
		},
		defaultPrevented: 0,
		isTrusted: 0
	}, td = rd(sd), ud = A({}, sd, {
		view: 0,
		detail: 0
	}), vd = rd(ud), wd, xd, yd, Ad = A({}, ud, {
		screenX: 0,
		screenY: 0,
		clientX: 0,
		clientY: 0,
		pageX: 0,
		pageY: 0,
		ctrlKey: 0,
		shiftKey: 0,
		altKey: 0,
		metaKey: 0,
		getModifierState: zd,
		button: 0,
		buttons: 0,
		relatedTarget: function(a) {
			return void 0 === a.relatedTarget ? a.fromElement === a.srcElement ? a.toElement : a.fromElement : a.relatedTarget;
		},
		movementX: function(a) {
			if ("movementX" in a) return a.movementX;
			a !== yd && (yd && "mousemove" === a.type ? (wd = a.screenX - yd.screenX, xd = a.screenY - yd.screenY) : xd = wd = 0, yd = a);
			return wd;
		},
		movementY: function(a) {
			return "movementY" in a ? a.movementY : xd;
		}
	}), Bd = rd(Ad), Dd = rd(A({}, Ad, { dataTransfer: 0 })), Fd = rd(A({}, ud, { relatedTarget: 0 })), Hd = rd(A({}, sd, {
		animationName: 0,
		elapsedTime: 0,
		pseudoElement: 0
	})), Jd = rd(A({}, sd, { clipboardData: function(a) {
		return "clipboardData" in a ? a.clipboardData : window.clipboardData;
	} })), Ld = rd(A({}, sd, { data: 0 })), Md = {
		Esc: "Escape",
		Spacebar: " ",
		Left: "ArrowLeft",
		Up: "ArrowUp",
		Right: "ArrowRight",
		Down: "ArrowDown",
		Del: "Delete",
		Win: "OS",
		Menu: "ContextMenu",
		Apps: "ContextMenu",
		Scroll: "ScrollLock",
		MozPrintableKey: "Unidentified"
	}, Nd = {
		8: "Backspace",
		9: "Tab",
		12: "Clear",
		13: "Enter",
		16: "Shift",
		17: "Control",
		18: "Alt",
		19: "Pause",
		20: "CapsLock",
		27: "Escape",
		32: " ",
		33: "PageUp",
		34: "PageDown",
		35: "End",
		36: "Home",
		37: "ArrowLeft",
		38: "ArrowUp",
		39: "ArrowRight",
		40: "ArrowDown",
		45: "Insert",
		46: "Delete",
		112: "F1",
		113: "F2",
		114: "F3",
		115: "F4",
		116: "F5",
		117: "F6",
		118: "F7",
		119: "F8",
		120: "F9",
		121: "F10",
		122: "F11",
		123: "F12",
		144: "NumLock",
		145: "ScrollLock",
		224: "Meta"
	}, Od = {
		Alt: "altKey",
		Control: "ctrlKey",
		Meta: "metaKey",
		Shift: "shiftKey"
	};
	function Pd(a) {
		var b$1 = this.nativeEvent;
		return b$1.getModifierState ? b$1.getModifierState(a) : (a = Od[a]) ? !!b$1[a] : !1;
	}
	function zd() {
		return Pd;
	}
	var Rd = rd(A({}, ud, {
		key: function(a) {
			if (a.key) {
				var b$1 = Md[a.key] || a.key;
				if ("Unidentified" !== b$1) return b$1;
			}
			return "keypress" === a.type ? (a = od(a), 13 === a ? "Enter" : String.fromCharCode(a)) : "keydown" === a.type || "keyup" === a.type ? Nd[a.keyCode] || "Unidentified" : "";
		},
		code: 0,
		location: 0,
		ctrlKey: 0,
		shiftKey: 0,
		altKey: 0,
		metaKey: 0,
		repeat: 0,
		locale: 0,
		getModifierState: zd,
		charCode: function(a) {
			return "keypress" === a.type ? od(a) : 0;
		},
		keyCode: function(a) {
			return "keydown" === a.type || "keyup" === a.type ? a.keyCode : 0;
		},
		which: function(a) {
			return "keypress" === a.type ? od(a) : "keydown" === a.type || "keyup" === a.type ? a.keyCode : 0;
		}
	})), Td = rd(A({}, Ad, {
		pointerId: 0,
		width: 0,
		height: 0,
		pressure: 0,
		tangentialPressure: 0,
		tiltX: 0,
		tiltY: 0,
		twist: 0,
		pointerType: 0,
		isPrimary: 0
	})), Vd = rd(A({}, ud, {
		touches: 0,
		targetTouches: 0,
		changedTouches: 0,
		altKey: 0,
		metaKey: 0,
		ctrlKey: 0,
		shiftKey: 0,
		getModifierState: zd
	})), Xd = rd(A({}, sd, {
		propertyName: 0,
		elapsedTime: 0,
		pseudoElement: 0
	})), Zd = rd(A({}, Ad, {
		deltaX: function(a) {
			return "deltaX" in a ? a.deltaX : "wheelDeltaX" in a ? -a.wheelDeltaX : 0;
		},
		deltaY: function(a) {
			return "deltaY" in a ? a.deltaY : "wheelDeltaY" in a ? -a.wheelDeltaY : "wheelDelta" in a ? -a.wheelDelta : 0;
		},
		deltaZ: 0,
		deltaMode: 0
	})), $d = [
		9,
		13,
		27,
		32
	], ae = ia && "CompositionEvent" in window, be = null;
	ia && "documentMode" in document && (be = document.documentMode);
	var ce = ia && "TextEvent" in window && !be, de = ia && (!ae || be && 8 < be && 11 >= be), ee = String.fromCharCode(32), fe = !1;
	function ge(a, b$1) {
		switch (a) {
			case "keyup": return -1 !== $d.indexOf(b$1.keyCode);
			case "keydown": return 229 !== b$1.keyCode;
			case "keypress":
			case "mousedown":
			case "focusout": return !0;
			default: return !1;
		}
	}
	function he(a) {
		a = a.detail;
		return "object" === typeof a && "data" in a ? a.data : null;
	}
	var ie = !1;
	function je(a, b$1) {
		switch (a) {
			case "compositionend": return he(b$1);
			case "keypress":
				if (32 !== b$1.which) return null;
				fe = !0;
				return ee;
			case "textInput": return a = b$1.data, a === ee && fe ? null : a;
			default: return null;
		}
	}
	function ke(a, b$1) {
		if (ie) return "compositionend" === a || !ae && ge(a, b$1) ? (a = nd(), md = ld = kd = null, ie = !1, a) : null;
		switch (a) {
			case "paste": return null;
			case "keypress":
				if (!(b$1.ctrlKey || b$1.altKey || b$1.metaKey) || b$1.ctrlKey && b$1.altKey) {
					if (b$1.char && 1 < b$1.char.length) return b$1.char;
					if (b$1.which) return String.fromCharCode(b$1.which);
				}
				return null;
			case "compositionend": return de && "ko" !== b$1.locale ? null : b$1.data;
			default: return null;
		}
	}
	var le = {
		color: !0,
		date: !0,
		datetime: !0,
		"datetime-local": !0,
		email: !0,
		month: !0,
		number: !0,
		password: !0,
		range: !0,
		search: !0,
		tel: !0,
		text: !0,
		time: !0,
		url: !0,
		week: !0
	};
	function me(a) {
		var b$1 = a && a.nodeName && a.nodeName.toLowerCase();
		return "input" === b$1 ? !!le[a.type] : "textarea" === b$1 ? !0 : !1;
	}
	function ne(a, b$1, c, d) {
		Eb(d);
		b$1 = oe(b$1, "onChange");
		0 < b$1.length && (c = new td("onChange", "change", null, c, d), a.push({
			event: c,
			listeners: b$1
		}));
	}
	var pe = null, qe = null;
	function re(a) {
		se(a, 0);
	}
	function te(a) {
		if (Wa(ue(a))) return a;
	}
	function ve(a, b$1) {
		if ("change" === a) return b$1;
	}
	var we = !1;
	if (ia) {
		var xe;
		if (ia) {
			var ye = "oninput" in document;
			if (!ye) {
				var ze = document.createElement("div");
				ze.setAttribute("oninput", "return;");
				ye = "function" === typeof ze.oninput;
			}
			xe = ye;
		} else xe = !1;
		we = xe && (!document.documentMode || 9 < document.documentMode);
	}
	function Ae() {
		pe && (pe.detachEvent("onpropertychange", Be), qe = pe = null);
	}
	function Be(a) {
		if ("value" === a.propertyName && te(qe)) {
			var b$1 = [];
			ne(b$1, qe, a, xb(a));
			Jb(re, b$1);
		}
	}
	function Ce(a, b$1, c) {
		"focusin" === a ? (Ae(), pe = b$1, qe = c, pe.attachEvent("onpropertychange", Be)) : "focusout" === a && Ae();
	}
	function De(a) {
		if ("selectionchange" === a || "keyup" === a || "keydown" === a) return te(qe);
	}
	function Ee(a, b$1) {
		if ("click" === a) return te(b$1);
	}
	function Fe(a, b$1) {
		if ("input" === a || "change" === a) return te(b$1);
	}
	function Ge(a, b$1) {
		return a === b$1 && (0 !== a || 1 / a === 1 / b$1) || a !== a && b$1 !== b$1;
	}
	var He = "function" === typeof Object.is ? Object.is : Ge;
	function Ie(a, b$1) {
		if (He(a, b$1)) return !0;
		if ("object" !== typeof a || null === a || "object" !== typeof b$1 || null === b$1) return !1;
		var c = Object.keys(a), d = Object.keys(b$1);
		if (c.length !== d.length) return !1;
		for (d = 0; d < c.length; d++) {
			var e = c[d];
			if (!ja.call(b$1, e) || !He(a[e], b$1[e])) return !1;
		}
		return !0;
	}
	function Je(a) {
		for (; a && a.firstChild;) a = a.firstChild;
		return a;
	}
	function Ke(a, b$1) {
		var c = Je(a);
		a = 0;
		for (var d; c;) {
			if (3 === c.nodeType) {
				d = a + c.textContent.length;
				if (a <= b$1 && d >= b$1) return {
					node: c,
					offset: b$1 - a
				};
				a = d;
			}
			a: {
				for (; c;) {
					if (c.nextSibling) {
						c = c.nextSibling;
						break a;
					}
					c = c.parentNode;
				}
				c = void 0;
			}
			c = Je(c);
		}
	}
	function Le(a, b$1) {
		return a && b$1 ? a === b$1 ? !0 : a && 3 === a.nodeType ? !1 : b$1 && 3 === b$1.nodeType ? Le(a, b$1.parentNode) : "contains" in a ? a.contains(b$1) : a.compareDocumentPosition ? !!(a.compareDocumentPosition(b$1) & 16) : !1 : !1;
	}
	function Me() {
		for (var a = window, b$1 = Xa(); b$1 instanceof a.HTMLIFrameElement;) {
			try {
				var c = "string" === typeof b$1.contentWindow.location.href;
			} catch (d) {
				c = !1;
			}
			if (c) a = b$1.contentWindow;
			else break;
			b$1 = Xa(a.document);
		}
		return b$1;
	}
	function Ne(a) {
		var b$1 = a && a.nodeName && a.nodeName.toLowerCase();
		return b$1 && ("input" === b$1 && ("text" === a.type || "search" === a.type || "tel" === a.type || "url" === a.type || "password" === a.type) || "textarea" === b$1 || "true" === a.contentEditable);
	}
	function Oe(a) {
		var b$1 = Me(), c = a.focusedElem, d = a.selectionRange;
		if (b$1 !== c && c && c.ownerDocument && Le(c.ownerDocument.documentElement, c)) {
			if (null !== d && Ne(c)) {
				if (b$1 = d.start, a = d.end, void 0 === a && (a = b$1), "selectionStart" in c) c.selectionStart = b$1, c.selectionEnd = Math.min(a, c.value.length);
				else if (a = (b$1 = c.ownerDocument || document) && b$1.defaultView || window, a.getSelection) {
					a = a.getSelection();
					var e = c.textContent.length, f$2 = Math.min(d.start, e);
					d = void 0 === d.end ? f$2 : Math.min(d.end, e);
					!a.extend && f$2 > d && (e = d, d = f$2, f$2 = e);
					e = Ke(c, f$2);
					var g$2 = Ke(c, d);
					e && g$2 && (1 !== a.rangeCount || a.anchorNode !== e.node || a.anchorOffset !== e.offset || a.focusNode !== g$2.node || a.focusOffset !== g$2.offset) && (b$1 = b$1.createRange(), b$1.setStart(e.node, e.offset), a.removeAllRanges(), f$2 > d ? (a.addRange(b$1), a.extend(g$2.node, g$2.offset)) : (b$1.setEnd(g$2.node, g$2.offset), a.addRange(b$1)));
				}
			}
			b$1 = [];
			for (a = c; a = a.parentNode;) 1 === a.nodeType && b$1.push({
				element: a,
				left: a.scrollLeft,
				top: a.scrollTop
			});
			"function" === typeof c.focus && c.focus();
			for (c = 0; c < b$1.length; c++) a = b$1[c], a.element.scrollLeft = a.left, a.element.scrollTop = a.top;
		}
	}
	var Pe = ia && "documentMode" in document && 11 >= document.documentMode, Qe = null, Re = null, Se = null, Te = !1;
	function Ue(a, b$1, c) {
		var d = c.window === c ? c.document : 9 === c.nodeType ? c : c.ownerDocument;
		Te || null == Qe || Qe !== Xa(d) || (d = Qe, "selectionStart" in d && Ne(d) ? d = {
			start: d.selectionStart,
			end: d.selectionEnd
		} : (d = (d.ownerDocument && d.ownerDocument.defaultView || window).getSelection(), d = {
			anchorNode: d.anchorNode,
			anchorOffset: d.anchorOffset,
			focusNode: d.focusNode,
			focusOffset: d.focusOffset
		}), Se && Ie(Se, d) || (Se = d, d = oe(Re, "onSelect"), 0 < d.length && (b$1 = new td("onSelect", "select", null, b$1, c), a.push({
			event: b$1,
			listeners: d
		}), b$1.target = Qe)));
	}
	function Ve(a, b$1) {
		var c = {};
		c[a.toLowerCase()] = b$1.toLowerCase();
		c["Webkit" + a] = "webkit" + b$1;
		c["Moz" + a] = "moz" + b$1;
		return c;
	}
	var We = {
		animationend: Ve("Animation", "AnimationEnd"),
		animationiteration: Ve("Animation", "AnimationIteration"),
		animationstart: Ve("Animation", "AnimationStart"),
		transitionend: Ve("Transition", "TransitionEnd")
	}, Xe = {}, Ye = {};
	ia && (Ye = document.createElement("div").style, "AnimationEvent" in window || (delete We.animationend.animation, delete We.animationiteration.animation, delete We.animationstart.animation), "TransitionEvent" in window || delete We.transitionend.transition);
	function Ze(a) {
		if (Xe[a]) return Xe[a];
		if (!We[a]) return a;
		var b$1 = We[a], c;
		for (c in b$1) if (b$1.hasOwnProperty(c) && c in Ye) return Xe[a] = b$1[c];
		return a;
	}
	var $e = Ze("animationend"), af = Ze("animationiteration"), bf = Ze("animationstart"), cf = Ze("transitionend"), df = /* @__PURE__ */ new Map(), ef = "abort auxClick cancel canPlay canPlayThrough click close contextMenu copy cut drag dragEnd dragEnter dragExit dragLeave dragOver dragStart drop durationChange emptied encrypted ended error gotPointerCapture input invalid keyDown keyPress keyUp load loadedData loadedMetadata loadStart lostPointerCapture mouseDown mouseMove mouseOut mouseOver mouseUp paste pause play playing pointerCancel pointerDown pointerMove pointerOut pointerOver pointerUp progress rateChange reset resize seeked seeking stalled submit suspend timeUpdate touchCancel touchEnd touchStart volumeChange scroll toggle touchMove waiting wheel".split(" ");
	function ff(a, b$1) {
		df.set(a, b$1);
		fa(b$1, [a]);
	}
	for (var gf = 0; gf < ef.length; gf++) {
		var hf = ef[gf];
		ff(hf.toLowerCase(), "on" + (hf[0].toUpperCase() + hf.slice(1)));
	}
	ff($e, "onAnimationEnd");
	ff(af, "onAnimationIteration");
	ff(bf, "onAnimationStart");
	ff("dblclick", "onDoubleClick");
	ff("focusin", "onFocus");
	ff("focusout", "onBlur");
	ff(cf, "onTransitionEnd");
	ha("onMouseEnter", ["mouseout", "mouseover"]);
	ha("onMouseLeave", ["mouseout", "mouseover"]);
	ha("onPointerEnter", ["pointerout", "pointerover"]);
	ha("onPointerLeave", ["pointerout", "pointerover"]);
	fa("onChange", "change click focusin focusout input keydown keyup selectionchange".split(" "));
	fa("onSelect", "focusout contextmenu dragend focusin keydown keyup mousedown mouseup selectionchange".split(" "));
	fa("onBeforeInput", [
		"compositionend",
		"keypress",
		"textInput",
		"paste"
	]);
	fa("onCompositionEnd", "compositionend focusout keydown keypress keyup mousedown".split(" "));
	fa("onCompositionStart", "compositionstart focusout keydown keypress keyup mousedown".split(" "));
	fa("onCompositionUpdate", "compositionupdate focusout keydown keypress keyup mousedown".split(" "));
	var lf = "abort canplay canplaythrough durationchange emptied encrypted ended error loadeddata loadedmetadata loadstart pause play playing progress ratechange resize seeked seeking stalled suspend timeupdate volumechange waiting".split(" "), mf = new Set("cancel close invalid load scroll toggle".split(" ").concat(lf));
	function nf(a, b$1, c) {
		var d = a.type || "unknown-event";
		a.currentTarget = c;
		Ub(d, b$1, void 0, a);
		a.currentTarget = null;
	}
	function se(a, b$1) {
		b$1 = 0 !== (b$1 & 4);
		for (var c = 0; c < a.length; c++) {
			var d = a[c], e = d.event;
			d = d.listeners;
			a: {
				var f$2 = void 0;
				if (b$1) for (var g$2 = d.length - 1; 0 <= g$2; g$2--) {
					var h$1 = d[g$2], k$2 = h$1.instance, l$3 = h$1.currentTarget;
					h$1 = h$1.listener;
					if (k$2 !== f$2 && e.isPropagationStopped()) break a;
					nf(e, h$1, l$3);
					f$2 = k$2;
				}
				else for (g$2 = 0; g$2 < d.length; g$2++) {
					h$1 = d[g$2];
					k$2 = h$1.instance;
					l$3 = h$1.currentTarget;
					h$1 = h$1.listener;
					if (k$2 !== f$2 && e.isPropagationStopped()) break a;
					nf(e, h$1, l$3);
					f$2 = k$2;
				}
			}
		}
		if (Qb) throw a = Rb, Qb = !1, Rb = null, a;
	}
	function D(a, b$1) {
		var c = b$1[of];
		void 0 === c && (c = b$1[of] = /* @__PURE__ */ new Set());
		var d = a + "__bubble";
		c.has(d) || (pf(b$1, a, 2, !1), c.add(d));
	}
	function qf(a, b$1, c) {
		var d = 0;
		b$1 && (d |= 4);
		pf(c, a, d, b$1);
	}
	var rf = "_reactListening" + Math.random().toString(36).slice(2);
	function sf(a) {
		if (!a[rf]) {
			a[rf] = !0;
			da.forEach(function(b$2) {
				"selectionchange" !== b$2 && (mf.has(b$2) || qf(b$2, !1, a), qf(b$2, !0, a));
			});
			var b$1 = 9 === a.nodeType ? a : a.ownerDocument;
			null === b$1 || b$1[rf] || (b$1[rf] = !0, qf("selectionchange", !1, b$1));
		}
	}
	function pf(a, b$1, c, d) {
		switch (jd(b$1)) {
			case 1:
				var e = ed;
				break;
			case 4:
				e = gd;
				break;
			default: e = fd;
		}
		c = e.bind(null, b$1, c, a);
		e = void 0;
		!Lb || "touchstart" !== b$1 && "touchmove" !== b$1 && "wheel" !== b$1 || (e = !0);
		d ? void 0 !== e ? a.addEventListener(b$1, c, {
			capture: !0,
			passive: e
		}) : a.addEventListener(b$1, c, !0) : void 0 !== e ? a.addEventListener(b$1, c, { passive: e }) : a.addEventListener(b$1, c, !1);
	}
	function hd(a, b$1, c, d, e) {
		var f$2 = d;
		if (0 === (b$1 & 1) && 0 === (b$1 & 2) && null !== d) a: for (;;) {
			if (null === d) return;
			var g$2 = d.tag;
			if (3 === g$2 || 4 === g$2) {
				var h$1 = d.stateNode.containerInfo;
				if (h$1 === e || 8 === h$1.nodeType && h$1.parentNode === e) break;
				if (4 === g$2) for (g$2 = d.return; null !== g$2;) {
					var k$2 = g$2.tag;
					if (3 === k$2 || 4 === k$2) {
						if (k$2 = g$2.stateNode.containerInfo, k$2 === e || 8 === k$2.nodeType && k$2.parentNode === e) return;
					}
					g$2 = g$2.return;
				}
				for (; null !== h$1;) {
					g$2 = Wc(h$1);
					if (null === g$2) return;
					k$2 = g$2.tag;
					if (5 === k$2 || 6 === k$2) {
						d = f$2 = g$2;
						continue a;
					}
					h$1 = h$1.parentNode;
				}
			}
			d = d.return;
		}
		Jb(function() {
			var d$1 = f$2, e$1 = xb(c), g$3 = [];
			a: {
				var h$2 = df.get(a);
				if (void 0 !== h$2) {
					var k$3 = td, n$2 = a;
					switch (a) {
						case "keypress": if (0 === od(c)) break a;
						case "keydown":
						case "keyup":
							k$3 = Rd;
							break;
						case "focusin":
							n$2 = "focus";
							k$3 = Fd;
							break;
						case "focusout":
							n$2 = "blur";
							k$3 = Fd;
							break;
						case "beforeblur":
						case "afterblur":
							k$3 = Fd;
							break;
						case "click": if (2 === c.button) break a;
						case "auxclick":
						case "dblclick":
						case "mousedown":
						case "mousemove":
						case "mouseup":
						case "mouseout":
						case "mouseover":
						case "contextmenu":
							k$3 = Bd;
							break;
						case "drag":
						case "dragend":
						case "dragenter":
						case "dragexit":
						case "dragleave":
						case "dragover":
						case "dragstart":
						case "drop":
							k$3 = Dd;
							break;
						case "touchcancel":
						case "touchend":
						case "touchmove":
						case "touchstart":
							k$3 = Vd;
							break;
						case $e:
						case af:
						case bf:
							k$3 = Hd;
							break;
						case cf:
							k$3 = Xd;
							break;
						case "scroll":
							k$3 = vd;
							break;
						case "wheel":
							k$3 = Zd;
							break;
						case "copy":
						case "cut":
						case "paste":
							k$3 = Jd;
							break;
						case "gotpointercapture":
						case "lostpointercapture":
						case "pointercancel":
						case "pointerdown":
						case "pointermove":
						case "pointerout":
						case "pointerover":
						case "pointerup": k$3 = Td;
					}
					var t$2 = 0 !== (b$1 & 4), J$3 = !t$2 && "scroll" === a, x$2 = t$2 ? null !== h$2 ? h$2 + "Capture" : null : h$2;
					t$2 = [];
					for (var w$1 = d$1, u$3; null !== w$1;) {
						u$3 = w$1;
						var F$2 = u$3.stateNode;
						5 === u$3.tag && null !== F$2 && (u$3 = F$2, null !== x$2 && (F$2 = Kb(w$1, x$2), null != F$2 && t$2.push(tf(w$1, F$2, u$3))));
						if (J$3) break;
						w$1 = w$1.return;
					}
					0 < t$2.length && (h$2 = new k$3(h$2, n$2, null, c, e$1), g$3.push({
						event: h$2,
						listeners: t$2
					}));
				}
			}
			if (0 === (b$1 & 7)) {
				a: {
					h$2 = "mouseover" === a || "pointerover" === a;
					k$3 = "mouseout" === a || "pointerout" === a;
					if (h$2 && c !== wb && (n$2 = c.relatedTarget || c.fromElement) && (Wc(n$2) || n$2[uf])) break a;
					if (k$3 || h$2) {
						h$2 = e$1.window === e$1 ? e$1 : (h$2 = e$1.ownerDocument) ? h$2.defaultView || h$2.parentWindow : window;
						if (k$3) {
							if (n$2 = c.relatedTarget || c.toElement, k$3 = d$1, n$2 = n$2 ? Wc(n$2) : null, null !== n$2 && (J$3 = Vb(n$2), n$2 !== J$3 || 5 !== n$2.tag && 6 !== n$2.tag)) n$2 = null;
						} else k$3 = null, n$2 = d$1;
						if (k$3 !== n$2) {
							t$2 = Bd;
							F$2 = "onMouseLeave";
							x$2 = "onMouseEnter";
							w$1 = "mouse";
							if ("pointerout" === a || "pointerover" === a) t$2 = Td, F$2 = "onPointerLeave", x$2 = "onPointerEnter", w$1 = "pointer";
							J$3 = null == k$3 ? h$2 : ue(k$3);
							u$3 = null == n$2 ? h$2 : ue(n$2);
							h$2 = new t$2(F$2, w$1 + "leave", k$3, c, e$1);
							h$2.target = J$3;
							h$2.relatedTarget = u$3;
							F$2 = null;
							Wc(e$1) === d$1 && (t$2 = new t$2(x$2, w$1 + "enter", n$2, c, e$1), t$2.target = u$3, t$2.relatedTarget = J$3, F$2 = t$2);
							J$3 = F$2;
							if (k$3 && n$2) b: {
								t$2 = k$3;
								x$2 = n$2;
								w$1 = 0;
								for (u$3 = t$2; u$3; u$3 = vf(u$3)) w$1++;
								u$3 = 0;
								for (F$2 = x$2; F$2; F$2 = vf(F$2)) u$3++;
								for (; 0 < w$1 - u$3;) t$2 = vf(t$2), w$1--;
								for (; 0 < u$3 - w$1;) x$2 = vf(x$2), u$3--;
								for (; w$1--;) {
									if (t$2 === x$2 || null !== x$2 && t$2 === x$2.alternate) break b;
									t$2 = vf(t$2);
									x$2 = vf(x$2);
								}
								t$2 = null;
							}
							else t$2 = null;
							null !== k$3 && wf(g$3, h$2, k$3, t$2, !1);
							null !== n$2 && null !== J$3 && wf(g$3, J$3, n$2, t$2, !0);
						}
					}
				}
				a: {
					h$2 = d$1 ? ue(d$1) : window;
					k$3 = h$2.nodeName && h$2.nodeName.toLowerCase();
					if ("select" === k$3 || "input" === k$3 && "file" === h$2.type) var na = ve;
					else if (me(h$2)) if (we) na = Fe;
					else {
						na = De;
						var xa = Ce;
					}
					else (k$3 = h$2.nodeName) && "input" === k$3.toLowerCase() && ("checkbox" === h$2.type || "radio" === h$2.type) && (na = Ee);
					if (na && (na = na(a, d$1))) {
						ne(g$3, na, c, e$1);
						break a;
					}
					xa && xa(a, h$2, d$1);
					"focusout" === a && (xa = h$2._wrapperState) && xa.controlled && "number" === h$2.type && cb(h$2, "number", h$2.value);
				}
				xa = d$1 ? ue(d$1) : window;
				switch (a) {
					case "focusin":
						if (me(xa) || "true" === xa.contentEditable) Qe = xa, Re = d$1, Se = null;
						break;
					case "focusout":
						Se = Re = Qe = null;
						break;
					case "mousedown":
						Te = !0;
						break;
					case "contextmenu":
					case "mouseup":
					case "dragend":
						Te = !1;
						Ue(g$3, c, e$1);
						break;
					case "selectionchange": if (Pe) break;
					case "keydown":
					case "keyup": Ue(g$3, c, e$1);
				}
				var $a;
				if (ae) b: {
					switch (a) {
						case "compositionstart":
							var ba = "onCompositionStart";
							break b;
						case "compositionend":
							ba = "onCompositionEnd";
							break b;
						case "compositionupdate":
							ba = "onCompositionUpdate";
							break b;
					}
					ba = void 0;
				}
				else ie ? ge(a, c) && (ba = "onCompositionEnd") : "keydown" === a && 229 === c.keyCode && (ba = "onCompositionStart");
				ba && (de && "ko" !== c.locale && (ie || "onCompositionStart" !== ba ? "onCompositionEnd" === ba && ie && ($a = nd()) : (kd = e$1, ld = "value" in kd ? kd.value : kd.textContent, ie = !0)), xa = oe(d$1, ba), 0 < xa.length && (ba = new Ld(ba, a, null, c, e$1), g$3.push({
					event: ba,
					listeners: xa
				}), $a ? ba.data = $a : ($a = he(c), null !== $a && (ba.data = $a))));
				if ($a = ce ? je(a, c) : ke(a, c)) d$1 = oe(d$1, "onBeforeInput"), 0 < d$1.length && (e$1 = new Ld("onBeforeInput", "beforeinput", null, c, e$1), g$3.push({
					event: e$1,
					listeners: d$1
				}), e$1.data = $a);
			}
			se(g$3, b$1);
		});
	}
	function tf(a, b$1, c) {
		return {
			instance: a,
			listener: b$1,
			currentTarget: c
		};
	}
	function oe(a, b$1) {
		for (var c = b$1 + "Capture", d = []; null !== a;) {
			var e = a, f$2 = e.stateNode;
			5 === e.tag && null !== f$2 && (e = f$2, f$2 = Kb(a, c), null != f$2 && d.unshift(tf(a, f$2, e)), f$2 = Kb(a, b$1), null != f$2 && d.push(tf(a, f$2, e)));
			a = a.return;
		}
		return d;
	}
	function vf(a) {
		if (null === a) return null;
		do
			a = a.return;
		while (a && 5 !== a.tag);
		return a ? a : null;
	}
	function wf(a, b$1, c, d, e) {
		for (var f$2 = b$1._reactName, g$2 = []; null !== c && c !== d;) {
			var h$1 = c, k$2 = h$1.alternate, l$3 = h$1.stateNode;
			if (null !== k$2 && k$2 === d) break;
			5 === h$1.tag && null !== l$3 && (h$1 = l$3, e ? (k$2 = Kb(c, f$2), null != k$2 && g$2.unshift(tf(c, k$2, h$1))) : e || (k$2 = Kb(c, f$2), null != k$2 && g$2.push(tf(c, k$2, h$1))));
			c = c.return;
		}
		0 !== g$2.length && a.push({
			event: b$1,
			listeners: g$2
		});
	}
	var xf = /\r\n?/g, yf = /\u0000|\uFFFD/g;
	function zf(a) {
		return ("string" === typeof a ? a : "" + a).replace(xf, "\n").replace(yf, "");
	}
	function Af(a, b$1, c) {
		b$1 = zf(b$1);
		if (zf(a) !== b$1 && c) throw Error(p$1(425));
	}
	function Bf() {}
	var Cf = null, Df = null;
	function Ef(a, b$1) {
		return "textarea" === a || "noscript" === a || "string" === typeof b$1.children || "number" === typeof b$1.children || "object" === typeof b$1.dangerouslySetInnerHTML && null !== b$1.dangerouslySetInnerHTML && null != b$1.dangerouslySetInnerHTML.__html;
	}
	var Ff = "function" === typeof setTimeout ? setTimeout : void 0, Gf = "function" === typeof clearTimeout ? clearTimeout : void 0, Hf = "function" === typeof Promise ? Promise : void 0, Jf = "function" === typeof queueMicrotask ? queueMicrotask : "undefined" !== typeof Hf ? function(a) {
		return Hf.resolve(null).then(a).catch(If);
	} : Ff;
	function If(a) {
		setTimeout(function() {
			throw a;
		});
	}
	function Kf(a, b$1) {
		var c = b$1, d = 0;
		do {
			var e = c.nextSibling;
			a.removeChild(c);
			if (e && 8 === e.nodeType) if (c = e.data, "/$" === c) {
				if (0 === d) {
					a.removeChild(e);
					bd(b$1);
					return;
				}
				d--;
			} else "$" !== c && "$?" !== c && "$!" !== c || d++;
			c = e;
		} while (c);
		bd(b$1);
	}
	function Lf(a) {
		for (; null != a; a = a.nextSibling) {
			var b$1 = a.nodeType;
			if (1 === b$1 || 3 === b$1) break;
			if (8 === b$1) {
				b$1 = a.data;
				if ("$" === b$1 || "$!" === b$1 || "$?" === b$1) break;
				if ("/$" === b$1) return null;
			}
		}
		return a;
	}
	function Mf(a) {
		a = a.previousSibling;
		for (var b$1 = 0; a;) {
			if (8 === a.nodeType) {
				var c = a.data;
				if ("$" === c || "$!" === c || "$?" === c) {
					if (0 === b$1) return a;
					b$1--;
				} else "/$" === c && b$1++;
			}
			a = a.previousSibling;
		}
		return null;
	}
	var Nf = Math.random().toString(36).slice(2), Of = "__reactFiber$" + Nf, Pf = "__reactProps$" + Nf, uf = "__reactContainer$" + Nf, of = "__reactEvents$" + Nf, Qf = "__reactListeners$" + Nf, Rf = "__reactHandles$" + Nf;
	function Wc(a) {
		var b$1 = a[Of];
		if (b$1) return b$1;
		for (var c = a.parentNode; c;) {
			if (b$1 = c[uf] || c[Of]) {
				c = b$1.alternate;
				if (null !== b$1.child || null !== c && null !== c.child) for (a = Mf(a); null !== a;) {
					if (c = a[Of]) return c;
					a = Mf(a);
				}
				return b$1;
			}
			a = c;
			c = a.parentNode;
		}
		return null;
	}
	function Cb(a) {
		a = a[Of] || a[uf];
		return !a || 5 !== a.tag && 6 !== a.tag && 13 !== a.tag && 3 !== a.tag ? null : a;
	}
	function ue(a) {
		if (5 === a.tag || 6 === a.tag) return a.stateNode;
		throw Error(p$1(33));
	}
	function Db(a) {
		return a[Pf] || null;
	}
	var Sf = [], Tf = -1;
	function Uf(a) {
		return { current: a };
	}
	function E$1(a) {
		0 > Tf || (a.current = Sf[Tf], Sf[Tf] = null, Tf--);
	}
	function G(a, b$1) {
		Tf++;
		Sf[Tf] = a.current;
		a.current = b$1;
	}
	var Vf = {}, H$1 = Uf(Vf), Wf = Uf(!1), Xf = Vf;
	function Yf(a, b$1) {
		var c = a.type.contextTypes;
		if (!c) return Vf;
		var d = a.stateNode;
		if (d && d.__reactInternalMemoizedUnmaskedChildContext === b$1) return d.__reactInternalMemoizedMaskedChildContext;
		var e = {}, f$2;
		for (f$2 in c) e[f$2] = b$1[f$2];
		d && (a = a.stateNode, a.__reactInternalMemoizedUnmaskedChildContext = b$1, a.__reactInternalMemoizedMaskedChildContext = e);
		return e;
	}
	function Zf(a) {
		a = a.childContextTypes;
		return null !== a && void 0 !== a;
	}
	function $f() {
		E$1(Wf);
		E$1(H$1);
	}
	function ag(a, b$1, c) {
		if (H$1.current !== Vf) throw Error(p$1(168));
		G(H$1, b$1);
		G(Wf, c);
	}
	function bg(a, b$1, c) {
		var d = a.stateNode;
		b$1 = b$1.childContextTypes;
		if ("function" !== typeof d.getChildContext) return c;
		d = d.getChildContext();
		for (var e in d) if (!(e in b$1)) throw Error(p$1(108, Ra(a) || "Unknown", e));
		return A({}, c, d);
	}
	function cg(a) {
		a = (a = a.stateNode) && a.__reactInternalMemoizedMergedChildContext || Vf;
		Xf = H$1.current;
		G(H$1, a);
		G(Wf, Wf.current);
		return !0;
	}
	function dg(a, b$1, c) {
		var d = a.stateNode;
		if (!d) throw Error(p$1(169));
		c ? (a = bg(a, b$1, Xf), d.__reactInternalMemoizedMergedChildContext = a, E$1(Wf), E$1(H$1), G(H$1, a)) : E$1(Wf);
		G(Wf, c);
	}
	var eg = null, fg = !1, gg = !1;
	function hg(a) {
		null === eg ? eg = [a] : eg.push(a);
	}
	function ig(a) {
		fg = !0;
		hg(a);
	}
	function jg() {
		if (!gg && null !== eg) {
			gg = !0;
			var a = 0, b$1 = C;
			try {
				var c = eg;
				for (C = 1; a < c.length; a++) {
					var d = c[a];
					do
						d = d(!0);
					while (null !== d);
				}
				eg = null;
				fg = !1;
			} catch (e) {
				throw null !== eg && (eg = eg.slice(a + 1)), ac(fc, jg), e;
			} finally {
				C = b$1, gg = !1;
			}
		}
		return null;
	}
	var kg = [], lg = 0, mg = null, ng = 0, og = [], pg = 0, qg = null, rg = 1, sg = "";
	function tg(a, b$1) {
		kg[lg++] = ng;
		kg[lg++] = mg;
		mg = a;
		ng = b$1;
	}
	function ug(a, b$1, c) {
		og[pg++] = rg;
		og[pg++] = sg;
		og[pg++] = qg;
		qg = a;
		var d = rg;
		a = sg;
		var e = 32 - oc(d) - 1;
		d &= ~(1 << e);
		c += 1;
		var f$2 = 32 - oc(b$1) + e;
		if (30 < f$2) {
			var g$2 = e - e % 5;
			f$2 = (d & (1 << g$2) - 1).toString(32);
			d >>= g$2;
			e -= g$2;
			rg = 1 << 32 - oc(b$1) + e | c << e | d;
			sg = f$2 + a;
		} else rg = 1 << f$2 | c << e | d, sg = a;
	}
	function vg(a) {
		null !== a.return && (tg(a, 1), ug(a, 1, 0));
	}
	function wg(a) {
		for (; a === mg;) mg = kg[--lg], kg[lg] = null, ng = kg[--lg], kg[lg] = null;
		for (; a === qg;) qg = og[--pg], og[pg] = null, sg = og[--pg], og[pg] = null, rg = og[--pg], og[pg] = null;
	}
	var xg = null, yg = null, I$1 = !1, zg = null;
	function Ag(a, b$1) {
		var c = Bg(5, null, null, 0);
		c.elementType = "DELETED";
		c.stateNode = b$1;
		c.return = a;
		b$1 = a.deletions;
		null === b$1 ? (a.deletions = [c], a.flags |= 16) : b$1.push(c);
	}
	function Cg(a, b$1) {
		switch (a.tag) {
			case 5:
				var c = a.type;
				b$1 = 1 !== b$1.nodeType || c.toLowerCase() !== b$1.nodeName.toLowerCase() ? null : b$1;
				return null !== b$1 ? (a.stateNode = b$1, xg = a, yg = Lf(b$1.firstChild), !0) : !1;
			case 6: return b$1 = "" === a.pendingProps || 3 !== b$1.nodeType ? null : b$1, null !== b$1 ? (a.stateNode = b$1, xg = a, yg = null, !0) : !1;
			case 13: return b$1 = 8 !== b$1.nodeType ? null : b$1, null !== b$1 ? (c = null !== qg ? {
				id: rg,
				overflow: sg
			} : null, a.memoizedState = {
				dehydrated: b$1,
				treeContext: c,
				retryLane: 1073741824
			}, c = Bg(18, null, null, 0), c.stateNode = b$1, c.return = a, a.child = c, xg = a, yg = null, !0) : !1;
			default: return !1;
		}
	}
	function Dg(a) {
		return 0 !== (a.mode & 1) && 0 === (a.flags & 128);
	}
	function Eg(a) {
		if (I$1) {
			var b$1 = yg;
			if (b$1) {
				var c = b$1;
				if (!Cg(a, b$1)) {
					if (Dg(a)) throw Error(p$1(418));
					b$1 = Lf(c.nextSibling);
					var d = xg;
					b$1 && Cg(a, b$1) ? Ag(d, c) : (a.flags = a.flags & -4097 | 2, I$1 = !1, xg = a);
				}
			} else {
				if (Dg(a)) throw Error(p$1(418));
				a.flags = a.flags & -4097 | 2;
				I$1 = !1;
				xg = a;
			}
		}
	}
	function Fg(a) {
		for (a = a.return; null !== a && 5 !== a.tag && 3 !== a.tag && 13 !== a.tag;) a = a.return;
		xg = a;
	}
	function Gg(a) {
		if (a !== xg) return !1;
		if (!I$1) return Fg(a), I$1 = !0, !1;
		var b$1;
		(b$1 = 3 !== a.tag) && !(b$1 = 5 !== a.tag) && (b$1 = a.type, b$1 = "head" !== b$1 && "body" !== b$1 && !Ef(a.type, a.memoizedProps));
		if (b$1 && (b$1 = yg)) {
			if (Dg(a)) throw Hg(), Error(p$1(418));
			for (; b$1;) Ag(a, b$1), b$1 = Lf(b$1.nextSibling);
		}
		Fg(a);
		if (13 === a.tag) {
			a = a.memoizedState;
			a = null !== a ? a.dehydrated : null;
			if (!a) throw Error(p$1(317));
			a: {
				a = a.nextSibling;
				for (b$1 = 0; a;) {
					if (8 === a.nodeType) {
						var c = a.data;
						if ("/$" === c) {
							if (0 === b$1) {
								yg = Lf(a.nextSibling);
								break a;
							}
							b$1--;
						} else "$" !== c && "$!" !== c && "$?" !== c || b$1++;
					}
					a = a.nextSibling;
				}
				yg = null;
			}
		} else yg = xg ? Lf(a.stateNode.nextSibling) : null;
		return !0;
	}
	function Hg() {
		for (var a = yg; a;) a = Lf(a.nextSibling);
	}
	function Ig() {
		yg = xg = null;
		I$1 = !1;
	}
	function Jg(a) {
		null === zg ? zg = [a] : zg.push(a);
	}
	var Kg = ua.ReactCurrentBatchConfig;
	function Lg(a, b$1, c) {
		a = c.ref;
		if (null !== a && "function" !== typeof a && "object" !== typeof a) {
			if (c._owner) {
				c = c._owner;
				if (c) {
					if (1 !== c.tag) throw Error(p$1(309));
					var d = c.stateNode;
				}
				if (!d) throw Error(p$1(147, a));
				var e = d, f$2 = "" + a;
				if (null !== b$1 && null !== b$1.ref && "function" === typeof b$1.ref && b$1.ref._stringRef === f$2) return b$1.ref;
				b$1 = function(a$1) {
					var b$2 = e.refs;
					null === a$1 ? delete b$2[f$2] : b$2[f$2] = a$1;
				};
				b$1._stringRef = f$2;
				return b$1;
			}
			if ("string" !== typeof a) throw Error(p$1(284));
			if (!c._owner) throw Error(p$1(290, a));
		}
		return a;
	}
	function Mg(a, b$1) {
		a = Object.prototype.toString.call(b$1);
		throw Error(p$1(31, "[object Object]" === a ? "object with keys {" + Object.keys(b$1).join(", ") + "}" : a));
	}
	function Ng(a) {
		var b$1 = a._init;
		return b$1(a._payload);
	}
	function Og(a) {
		function b$1(b$2, c$1) {
			if (a) {
				var d$1 = b$2.deletions;
				null === d$1 ? (b$2.deletions = [c$1], b$2.flags |= 16) : d$1.push(c$1);
			}
		}
		function c(c$1, d$1) {
			if (!a) return null;
			for (; null !== d$1;) b$1(c$1, d$1), d$1 = d$1.sibling;
			return null;
		}
		function d(a$1, b$2) {
			for (a$1 = /* @__PURE__ */ new Map(); null !== b$2;) null !== b$2.key ? a$1.set(b$2.key, b$2) : a$1.set(b$2.index, b$2), b$2 = b$2.sibling;
			return a$1;
		}
		function e(a$1, b$2) {
			a$1 = Pg(a$1, b$2);
			a$1.index = 0;
			a$1.sibling = null;
			return a$1;
		}
		function f$2(b$2, c$1, d$1) {
			b$2.index = d$1;
			if (!a) return b$2.flags |= 1048576, c$1;
			d$1 = b$2.alternate;
			if (null !== d$1) return d$1 = d$1.index, d$1 < c$1 ? (b$2.flags |= 2, c$1) : d$1;
			b$2.flags |= 2;
			return c$1;
		}
		function g$2(b$2) {
			a && null === b$2.alternate && (b$2.flags |= 2);
			return b$2;
		}
		function h$1(a$1, b$2, c$1, d$1) {
			if (null === b$2 || 6 !== b$2.tag) return b$2 = Qg(c$1, a$1.mode, d$1), b$2.return = a$1, b$2;
			b$2 = e(b$2, c$1);
			b$2.return = a$1;
			return b$2;
		}
		function k$2(a$1, b$2, c$1, d$1) {
			var f$3 = c$1.type;
			if (f$3 === ya) return m$2(a$1, b$2, c$1.props.children, d$1, c$1.key);
			if (null !== b$2 && (b$2.elementType === f$3 || "object" === typeof f$3 && null !== f$3 && f$3.$$typeof === Ha && Ng(f$3) === b$2.type)) return d$1 = e(b$2, c$1.props), d$1.ref = Lg(a$1, b$2, c$1), d$1.return = a$1, d$1;
			d$1 = Rg(c$1.type, c$1.key, c$1.props, null, a$1.mode, d$1);
			d$1.ref = Lg(a$1, b$2, c$1);
			d$1.return = a$1;
			return d$1;
		}
		function l$3(a$1, b$2, c$1, d$1) {
			if (null === b$2 || 4 !== b$2.tag || b$2.stateNode.containerInfo !== c$1.containerInfo || b$2.stateNode.implementation !== c$1.implementation) return b$2 = Sg(c$1, a$1.mode, d$1), b$2.return = a$1, b$2;
			b$2 = e(b$2, c$1.children || []);
			b$2.return = a$1;
			return b$2;
		}
		function m$2(a$1, b$2, c$1, d$1, f$3) {
			if (null === b$2 || 7 !== b$2.tag) return b$2 = Tg(c$1, a$1.mode, d$1, f$3), b$2.return = a$1, b$2;
			b$2 = e(b$2, c$1);
			b$2.return = a$1;
			return b$2;
		}
		function q$3(a$1, b$2, c$1) {
			if ("string" === typeof b$2 && "" !== b$2 || "number" === typeof b$2) return b$2 = Qg("" + b$2, a$1.mode, c$1), b$2.return = a$1, b$2;
			if ("object" === typeof b$2 && null !== b$2) {
				switch (b$2.$$typeof) {
					case va: return c$1 = Rg(b$2.type, b$2.key, b$2.props, null, a$1.mode, c$1), c$1.ref = Lg(a$1, null, b$2), c$1.return = a$1, c$1;
					case wa: return b$2 = Sg(b$2, a$1.mode, c$1), b$2.return = a$1, b$2;
					case Ha:
						var d$1 = b$2._init;
						return q$3(a$1, d$1(b$2._payload), c$1);
				}
				if (eb(b$2) || Ka(b$2)) return b$2 = Tg(b$2, a$1.mode, c$1, null), b$2.return = a$1, b$2;
				Mg(a$1, b$2);
			}
			return null;
		}
		function r$3(a$1, b$2, c$1, d$1) {
			var e$1 = null !== b$2 ? b$2.key : null;
			if ("string" === typeof c$1 && "" !== c$1 || "number" === typeof c$1) return null !== e$1 ? null : h$1(a$1, b$2, "" + c$1, d$1);
			if ("object" === typeof c$1 && null !== c$1) {
				switch (c$1.$$typeof) {
					case va: return c$1.key === e$1 ? k$2(a$1, b$2, c$1, d$1) : null;
					case wa: return c$1.key === e$1 ? l$3(a$1, b$2, c$1, d$1) : null;
					case Ha: return e$1 = c$1._init, r$3(a$1, b$2, e$1(c$1._payload), d$1);
				}
				if (eb(c$1) || Ka(c$1)) return null !== e$1 ? null : m$2(a$1, b$2, c$1, d$1, null);
				Mg(a$1, c$1);
			}
			return null;
		}
		function y$2(a$1, b$2, c$1, d$1, e$1) {
			if ("string" === typeof d$1 && "" !== d$1 || "number" === typeof d$1) return a$1 = a$1.get(c$1) || null, h$1(b$2, a$1, "" + d$1, e$1);
			if ("object" === typeof d$1 && null !== d$1) {
				switch (d$1.$$typeof) {
					case va: return a$1 = a$1.get(null === d$1.key ? c$1 : d$1.key) || null, k$2(b$2, a$1, d$1, e$1);
					case wa: return a$1 = a$1.get(null === d$1.key ? c$1 : d$1.key) || null, l$3(b$2, a$1, d$1, e$1);
					case Ha:
						var f$3 = d$1._init;
						return y$2(a$1, b$2, c$1, f$3(d$1._payload), e$1);
				}
				if (eb(d$1) || Ka(d$1)) return a$1 = a$1.get(c$1) || null, m$2(b$2, a$1, d$1, e$1, null);
				Mg(b$2, d$1);
			}
			return null;
		}
		function n$2(e$1, g$3, h$2, k$3) {
			for (var l$4 = null, m$3 = null, u$3 = g$3, w$1 = g$3 = 0, x$2 = null; null !== u$3 && w$1 < h$2.length; w$1++) {
				u$3.index > w$1 ? (x$2 = u$3, u$3 = null) : x$2 = u$3.sibling;
				var n$3 = r$3(e$1, u$3, h$2[w$1], k$3);
				if (null === n$3) {
					null === u$3 && (u$3 = x$2);
					break;
				}
				a && u$3 && null === n$3.alternate && b$1(e$1, u$3);
				g$3 = f$2(n$3, g$3, w$1);
				null === m$3 ? l$4 = n$3 : m$3.sibling = n$3;
				m$3 = n$3;
				u$3 = x$2;
			}
			if (w$1 === h$2.length) return c(e$1, u$3), I$1 && tg(e$1, w$1), l$4;
			if (null === u$3) {
				for (; w$1 < h$2.length; w$1++) u$3 = q$3(e$1, h$2[w$1], k$3), null !== u$3 && (g$3 = f$2(u$3, g$3, w$1), null === m$3 ? l$4 = u$3 : m$3.sibling = u$3, m$3 = u$3);
				I$1 && tg(e$1, w$1);
				return l$4;
			}
			for (u$3 = d(e$1, u$3); w$1 < h$2.length; w$1++) x$2 = y$2(u$3, e$1, w$1, h$2[w$1], k$3), null !== x$2 && (a && null !== x$2.alternate && u$3.delete(null === x$2.key ? w$1 : x$2.key), g$3 = f$2(x$2, g$3, w$1), null === m$3 ? l$4 = x$2 : m$3.sibling = x$2, m$3 = x$2);
			a && u$3.forEach(function(a$1) {
				return b$1(e$1, a$1);
			});
			I$1 && tg(e$1, w$1);
			return l$4;
		}
		function t$2(e$1, g$3, h$2, k$3) {
			var l$4 = Ka(h$2);
			if ("function" !== typeof l$4) throw Error(p$1(150));
			h$2 = l$4.call(h$2);
			if (null == h$2) throw Error(p$1(151));
			for (var u$3 = l$4 = null, m$3 = g$3, w$1 = g$3 = 0, x$2 = null, n$3 = h$2.next(); null !== m$3 && !n$3.done; w$1++, n$3 = h$2.next()) {
				m$3.index > w$1 ? (x$2 = m$3, m$3 = null) : x$2 = m$3.sibling;
				var t$3 = r$3(e$1, m$3, n$3.value, k$3);
				if (null === t$3) {
					null === m$3 && (m$3 = x$2);
					break;
				}
				a && m$3 && null === t$3.alternate && b$1(e$1, m$3);
				g$3 = f$2(t$3, g$3, w$1);
				null === u$3 ? l$4 = t$3 : u$3.sibling = t$3;
				u$3 = t$3;
				m$3 = x$2;
			}
			if (n$3.done) return c(e$1, m$3), I$1 && tg(e$1, w$1), l$4;
			if (null === m$3) {
				for (; !n$3.done; w$1++, n$3 = h$2.next()) n$3 = q$3(e$1, n$3.value, k$3), null !== n$3 && (g$3 = f$2(n$3, g$3, w$1), null === u$3 ? l$4 = n$3 : u$3.sibling = n$3, u$3 = n$3);
				I$1 && tg(e$1, w$1);
				return l$4;
			}
			for (m$3 = d(e$1, m$3); !n$3.done; w$1++, n$3 = h$2.next()) n$3 = y$2(m$3, e$1, w$1, n$3.value, k$3), null !== n$3 && (a && null !== n$3.alternate && m$3.delete(null === n$3.key ? w$1 : n$3.key), g$3 = f$2(n$3, g$3, w$1), null === u$3 ? l$4 = n$3 : u$3.sibling = n$3, u$3 = n$3);
			a && m$3.forEach(function(a$1) {
				return b$1(e$1, a$1);
			});
			I$1 && tg(e$1, w$1);
			return l$4;
		}
		function J$3(a$1, d$1, f$3, h$2) {
			"object" === typeof f$3 && null !== f$3 && f$3.type === ya && null === f$3.key && (f$3 = f$3.props.children);
			if ("object" === typeof f$3 && null !== f$3) {
				switch (f$3.$$typeof) {
					case va:
						a: {
							for (var k$3 = f$3.key, l$4 = d$1; null !== l$4;) {
								if (l$4.key === k$3) {
									k$3 = f$3.type;
									if (k$3 === ya) {
										if (7 === l$4.tag) {
											c(a$1, l$4.sibling);
											d$1 = e(l$4, f$3.props.children);
											d$1.return = a$1;
											a$1 = d$1;
											break a;
										}
									} else if (l$4.elementType === k$3 || "object" === typeof k$3 && null !== k$3 && k$3.$$typeof === Ha && Ng(k$3) === l$4.type) {
										c(a$1, l$4.sibling);
										d$1 = e(l$4, f$3.props);
										d$1.ref = Lg(a$1, l$4, f$3);
										d$1.return = a$1;
										a$1 = d$1;
										break a;
									}
									c(a$1, l$4);
									break;
								} else b$1(a$1, l$4);
								l$4 = l$4.sibling;
							}
							f$3.type === ya ? (d$1 = Tg(f$3.props.children, a$1.mode, h$2, f$3.key), d$1.return = a$1, a$1 = d$1) : (h$2 = Rg(f$3.type, f$3.key, f$3.props, null, a$1.mode, h$2), h$2.ref = Lg(a$1, d$1, f$3), h$2.return = a$1, a$1 = h$2);
						}
						return g$2(a$1);
					case wa:
						a: {
							for (l$4 = f$3.key; null !== d$1;) {
								if (d$1.key === l$4) if (4 === d$1.tag && d$1.stateNode.containerInfo === f$3.containerInfo && d$1.stateNode.implementation === f$3.implementation) {
									c(a$1, d$1.sibling);
									d$1 = e(d$1, f$3.children || []);
									d$1.return = a$1;
									a$1 = d$1;
									break a;
								} else {
									c(a$1, d$1);
									break;
								}
								else b$1(a$1, d$1);
								d$1 = d$1.sibling;
							}
							d$1 = Sg(f$3, a$1.mode, h$2);
							d$1.return = a$1;
							a$1 = d$1;
						}
						return g$2(a$1);
					case Ha: return l$4 = f$3._init, J$3(a$1, d$1, l$4(f$3._payload), h$2);
				}
				if (eb(f$3)) return n$2(a$1, d$1, f$3, h$2);
				if (Ka(f$3)) return t$2(a$1, d$1, f$3, h$2);
				Mg(a$1, f$3);
			}
			return "string" === typeof f$3 && "" !== f$3 || "number" === typeof f$3 ? (f$3 = "" + f$3, null !== d$1 && 6 === d$1.tag ? (c(a$1, d$1.sibling), d$1 = e(d$1, f$3), d$1.return = a$1, a$1 = d$1) : (c(a$1, d$1), d$1 = Qg(f$3, a$1.mode, h$2), d$1.return = a$1, a$1 = d$1), g$2(a$1)) : c(a$1, d$1);
		}
		return J$3;
	}
	var Ug = Og(!0), Vg = Og(!1), Wg = Uf(null), Xg = null, Yg = null, Zg = null;
	function $g() {
		Zg = Yg = Xg = null;
	}
	function ah(a) {
		var b$1 = Wg.current;
		E$1(Wg);
		a._currentValue = b$1;
	}
	function bh(a, b$1, c) {
		for (; null !== a;) {
			var d = a.alternate;
			(a.childLanes & b$1) !== b$1 ? (a.childLanes |= b$1, null !== d && (d.childLanes |= b$1)) : null !== d && (d.childLanes & b$1) !== b$1 && (d.childLanes |= b$1);
			if (a === c) break;
			a = a.return;
		}
	}
	function ch(a, b$1) {
		Xg = a;
		Zg = Yg = null;
		a = a.dependencies;
		null !== a && null !== a.firstContext && (0 !== (a.lanes & b$1) && (dh = !0), a.firstContext = null);
	}
	function eh(a) {
		var b$1 = a._currentValue;
		if (Zg !== a) if (a = {
			context: a,
			memoizedValue: b$1,
			next: null
		}, null === Yg) {
			if (null === Xg) throw Error(p$1(308));
			Yg = a;
			Xg.dependencies = {
				lanes: 0,
				firstContext: a
			};
		} else Yg = Yg.next = a;
		return b$1;
	}
	var fh = null;
	function gh(a) {
		null === fh ? fh = [a] : fh.push(a);
	}
	function hh(a, b$1, c, d) {
		var e = b$1.interleaved;
		null === e ? (c.next = c, gh(b$1)) : (c.next = e.next, e.next = c);
		b$1.interleaved = c;
		return ih(a, d);
	}
	function ih(a, b$1) {
		a.lanes |= b$1;
		var c = a.alternate;
		null !== c && (c.lanes |= b$1);
		c = a;
		for (a = a.return; null !== a;) a.childLanes |= b$1, c = a.alternate, null !== c && (c.childLanes |= b$1), c = a, a = a.return;
		return 3 === c.tag ? c.stateNode : null;
	}
	var jh = !1;
	function kh(a) {
		a.updateQueue = {
			baseState: a.memoizedState,
			firstBaseUpdate: null,
			lastBaseUpdate: null,
			shared: {
				pending: null,
				interleaved: null,
				lanes: 0
			},
			effects: null
		};
	}
	function lh(a, b$1) {
		a = a.updateQueue;
		b$1.updateQueue === a && (b$1.updateQueue = {
			baseState: a.baseState,
			firstBaseUpdate: a.firstBaseUpdate,
			lastBaseUpdate: a.lastBaseUpdate,
			shared: a.shared,
			effects: a.effects
		});
	}
	function mh(a, b$1) {
		return {
			eventTime: a,
			lane: b$1,
			tag: 0,
			payload: null,
			callback: null,
			next: null
		};
	}
	function nh(a, b$1, c) {
		var d = a.updateQueue;
		if (null === d) return null;
		d = d.shared;
		if (0 !== (K & 2)) {
			var e = d.pending;
			null === e ? b$1.next = b$1 : (b$1.next = e.next, e.next = b$1);
			d.pending = b$1;
			return ih(a, c);
		}
		e = d.interleaved;
		null === e ? (b$1.next = b$1, gh(d)) : (b$1.next = e.next, e.next = b$1);
		d.interleaved = b$1;
		return ih(a, c);
	}
	function oh(a, b$1, c) {
		b$1 = b$1.updateQueue;
		if (null !== b$1 && (b$1 = b$1.shared, 0 !== (c & 4194240))) {
			var d = b$1.lanes;
			d &= a.pendingLanes;
			c |= d;
			b$1.lanes = c;
			Cc(a, c);
		}
	}
	function ph(a, b$1) {
		var c = a.updateQueue, d = a.alternate;
		if (null !== d && (d = d.updateQueue, c === d)) {
			var e = null, f$2 = null;
			c = c.firstBaseUpdate;
			if (null !== c) {
				do {
					var g$2 = {
						eventTime: c.eventTime,
						lane: c.lane,
						tag: c.tag,
						payload: c.payload,
						callback: c.callback,
						next: null
					};
					null === f$2 ? e = f$2 = g$2 : f$2 = f$2.next = g$2;
					c = c.next;
				} while (null !== c);
				null === f$2 ? e = f$2 = b$1 : f$2 = f$2.next = b$1;
			} else e = f$2 = b$1;
			c = {
				baseState: d.baseState,
				firstBaseUpdate: e,
				lastBaseUpdate: f$2,
				shared: d.shared,
				effects: d.effects
			};
			a.updateQueue = c;
			return;
		}
		a = c.lastBaseUpdate;
		null === a ? c.firstBaseUpdate = b$1 : a.next = b$1;
		c.lastBaseUpdate = b$1;
	}
	function qh(a, b$1, c, d) {
		var e = a.updateQueue;
		jh = !1;
		var f$2 = e.firstBaseUpdate, g$2 = e.lastBaseUpdate, h$1 = e.shared.pending;
		if (null !== h$1) {
			e.shared.pending = null;
			var k$2 = h$1, l$3 = k$2.next;
			k$2.next = null;
			null === g$2 ? f$2 = l$3 : g$2.next = l$3;
			g$2 = k$2;
			var m$2 = a.alternate;
			null !== m$2 && (m$2 = m$2.updateQueue, h$1 = m$2.lastBaseUpdate, h$1 !== g$2 && (null === h$1 ? m$2.firstBaseUpdate = l$3 : h$1.next = l$3, m$2.lastBaseUpdate = k$2));
		}
		if (null !== f$2) {
			var q$3 = e.baseState;
			g$2 = 0;
			m$2 = l$3 = k$2 = null;
			h$1 = f$2;
			do {
				var r$3 = h$1.lane, y$2 = h$1.eventTime;
				if ((d & r$3) === r$3) {
					null !== m$2 && (m$2 = m$2.next = {
						eventTime: y$2,
						lane: 0,
						tag: h$1.tag,
						payload: h$1.payload,
						callback: h$1.callback,
						next: null
					});
					a: {
						var n$2 = a, t$2 = h$1;
						r$3 = b$1;
						y$2 = c;
						switch (t$2.tag) {
							case 1:
								n$2 = t$2.payload;
								if ("function" === typeof n$2) {
									q$3 = n$2.call(y$2, q$3, r$3);
									break a;
								}
								q$3 = n$2;
								break a;
							case 3: n$2.flags = n$2.flags & -65537 | 128;
							case 0:
								n$2 = t$2.payload;
								r$3 = "function" === typeof n$2 ? n$2.call(y$2, q$3, r$3) : n$2;
								if (null === r$3 || void 0 === r$3) break a;
								q$3 = A({}, q$3, r$3);
								break a;
							case 2: jh = !0;
						}
					}
					null !== h$1.callback && 0 !== h$1.lane && (a.flags |= 64, r$3 = e.effects, null === r$3 ? e.effects = [h$1] : r$3.push(h$1));
				} else y$2 = {
					eventTime: y$2,
					lane: r$3,
					tag: h$1.tag,
					payload: h$1.payload,
					callback: h$1.callback,
					next: null
				}, null === m$2 ? (l$3 = m$2 = y$2, k$2 = q$3) : m$2 = m$2.next = y$2, g$2 |= r$3;
				h$1 = h$1.next;
				if (null === h$1) if (h$1 = e.shared.pending, null === h$1) break;
				else r$3 = h$1, h$1 = r$3.next, r$3.next = null, e.lastBaseUpdate = r$3, e.shared.pending = null;
			} while (1);
			null === m$2 && (k$2 = q$3);
			e.baseState = k$2;
			e.firstBaseUpdate = l$3;
			e.lastBaseUpdate = m$2;
			b$1 = e.shared.interleaved;
			if (null !== b$1) {
				e = b$1;
				do
					g$2 |= e.lane, e = e.next;
				while (e !== b$1);
			} else null === f$2 && (e.shared.lanes = 0);
			rh |= g$2;
			a.lanes = g$2;
			a.memoizedState = q$3;
		}
	}
	function sh(a, b$1, c) {
		a = b$1.effects;
		b$1.effects = null;
		if (null !== a) for (b$1 = 0; b$1 < a.length; b$1++) {
			var d = a[b$1], e = d.callback;
			if (null !== e) {
				d.callback = null;
				d = c;
				if ("function" !== typeof e) throw Error(p$1(191, e));
				e.call(d);
			}
		}
	}
	var th = {}, uh = Uf(th), vh = Uf(th), wh = Uf(th);
	function xh(a) {
		if (a === th) throw Error(p$1(174));
		return a;
	}
	function yh(a, b$1) {
		G(wh, b$1);
		G(vh, a);
		G(uh, th);
		a = b$1.nodeType;
		switch (a) {
			case 9:
			case 11:
				b$1 = (b$1 = b$1.documentElement) ? b$1.namespaceURI : lb(null, "");
				break;
			default: a = 8 === a ? b$1.parentNode : b$1, b$1 = a.namespaceURI || null, a = a.tagName, b$1 = lb(b$1, a);
		}
		E$1(uh);
		G(uh, b$1);
	}
	function zh() {
		E$1(uh);
		E$1(vh);
		E$1(wh);
	}
	function Ah(a) {
		xh(wh.current);
		var b$1 = xh(uh.current);
		var c = lb(b$1, a.type);
		b$1 !== c && (G(vh, a), G(uh, c));
	}
	function Bh(a) {
		vh.current === a && (E$1(uh), E$1(vh));
	}
	var L = Uf(0);
	function Ch(a) {
		for (var b$1 = a; null !== b$1;) {
			if (13 === b$1.tag) {
				var c = b$1.memoizedState;
				if (null !== c && (c = c.dehydrated, null === c || "$?" === c.data || "$!" === c.data)) return b$1;
			} else if (19 === b$1.tag && void 0 !== b$1.memoizedProps.revealOrder) {
				if (0 !== (b$1.flags & 128)) return b$1;
			} else if (null !== b$1.child) {
				b$1.child.return = b$1;
				b$1 = b$1.child;
				continue;
			}
			if (b$1 === a) break;
			for (; null === b$1.sibling;) {
				if (null === b$1.return || b$1.return === a) return null;
				b$1 = b$1.return;
			}
			b$1.sibling.return = b$1.return;
			b$1 = b$1.sibling;
		}
		return null;
	}
	var Dh = [];
	function Eh() {
		for (var a = 0; a < Dh.length; a++) Dh[a]._workInProgressVersionPrimary = null;
		Dh.length = 0;
	}
	var Fh = ua.ReactCurrentDispatcher, Gh = ua.ReactCurrentBatchConfig, Hh = 0, M$1 = null, N$1 = null, O$1 = null, Ih = !1, Jh = !1, Kh = 0, Lh = 0;
	function P() {
		throw Error(p$1(321));
	}
	function Mh(a, b$1) {
		if (null === b$1) return !1;
		for (var c = 0; c < b$1.length && c < a.length; c++) if (!He(a[c], b$1[c])) return !1;
		return !0;
	}
	function Nh(a, b$1, c, d, e, f$2) {
		Hh = f$2;
		M$1 = b$1;
		b$1.memoizedState = null;
		b$1.updateQueue = null;
		b$1.lanes = 0;
		Fh.current = null === a || null === a.memoizedState ? Oh : Ph;
		a = c(d, e);
		if (Jh) {
			f$2 = 0;
			do {
				Jh = !1;
				Kh = 0;
				if (25 <= f$2) throw Error(p$1(301));
				f$2 += 1;
				O$1 = N$1 = null;
				b$1.updateQueue = null;
				Fh.current = Qh;
				a = c(d, e);
			} while (Jh);
		}
		Fh.current = Rh;
		b$1 = null !== N$1 && null !== N$1.next;
		Hh = 0;
		O$1 = N$1 = M$1 = null;
		Ih = !1;
		if (b$1) throw Error(p$1(300));
		return a;
	}
	function Sh() {
		var a = 0 !== Kh;
		Kh = 0;
		return a;
	}
	function Th() {
		var a = {
			memoizedState: null,
			baseState: null,
			baseQueue: null,
			queue: null,
			next: null
		};
		null === O$1 ? M$1.memoizedState = O$1 = a : O$1 = O$1.next = a;
		return O$1;
	}
	function Uh() {
		if (null === N$1) {
			var a = M$1.alternate;
			a = null !== a ? a.memoizedState : null;
		} else a = N$1.next;
		var b$1 = null === O$1 ? M$1.memoizedState : O$1.next;
		if (null !== b$1) O$1 = b$1, N$1 = a;
		else {
			if (null === a) throw Error(p$1(310));
			N$1 = a;
			a = {
				memoizedState: N$1.memoizedState,
				baseState: N$1.baseState,
				baseQueue: N$1.baseQueue,
				queue: N$1.queue,
				next: null
			};
			null === O$1 ? M$1.memoizedState = O$1 = a : O$1 = O$1.next = a;
		}
		return O$1;
	}
	function Vh(a, b$1) {
		return "function" === typeof b$1 ? b$1(a) : b$1;
	}
	function Wh(a) {
		var b$1 = Uh(), c = b$1.queue;
		if (null === c) throw Error(p$1(311));
		c.lastRenderedReducer = a;
		var d = N$1, e = d.baseQueue, f$2 = c.pending;
		if (null !== f$2) {
			if (null !== e) {
				var g$2 = e.next;
				e.next = f$2.next;
				f$2.next = g$2;
			}
			d.baseQueue = e = f$2;
			c.pending = null;
		}
		if (null !== e) {
			f$2 = e.next;
			d = d.baseState;
			var h$1 = g$2 = null, k$2 = null, l$3 = f$2;
			do {
				var m$2 = l$3.lane;
				if ((Hh & m$2) === m$2) null !== k$2 && (k$2 = k$2.next = {
					lane: 0,
					action: l$3.action,
					hasEagerState: l$3.hasEagerState,
					eagerState: l$3.eagerState,
					next: null
				}), d = l$3.hasEagerState ? l$3.eagerState : a(d, l$3.action);
				else {
					var q$3 = {
						lane: m$2,
						action: l$3.action,
						hasEagerState: l$3.hasEagerState,
						eagerState: l$3.eagerState,
						next: null
					};
					null === k$2 ? (h$1 = k$2 = q$3, g$2 = d) : k$2 = k$2.next = q$3;
					M$1.lanes |= m$2;
					rh |= m$2;
				}
				l$3 = l$3.next;
			} while (null !== l$3 && l$3 !== f$2);
			null === k$2 ? g$2 = d : k$2.next = h$1;
			He(d, b$1.memoizedState) || (dh = !0);
			b$1.memoizedState = d;
			b$1.baseState = g$2;
			b$1.baseQueue = k$2;
			c.lastRenderedState = d;
		}
		a = c.interleaved;
		if (null !== a) {
			e = a;
			do
				f$2 = e.lane, M$1.lanes |= f$2, rh |= f$2, e = e.next;
			while (e !== a);
		} else null === e && (c.lanes = 0);
		return [b$1.memoizedState, c.dispatch];
	}
	function Xh(a) {
		var b$1 = Uh(), c = b$1.queue;
		if (null === c) throw Error(p$1(311));
		c.lastRenderedReducer = a;
		var d = c.dispatch, e = c.pending, f$2 = b$1.memoizedState;
		if (null !== e) {
			c.pending = null;
			var g$2 = e = e.next;
			do
				f$2 = a(f$2, g$2.action), g$2 = g$2.next;
			while (g$2 !== e);
			He(f$2, b$1.memoizedState) || (dh = !0);
			b$1.memoizedState = f$2;
			null === b$1.baseQueue && (b$1.baseState = f$2);
			c.lastRenderedState = f$2;
		}
		return [f$2, d];
	}
	function Yh() {}
	function Zh(a, b$1) {
		var c = M$1, d = Uh(), e = b$1(), f$2 = !He(d.memoizedState, e);
		f$2 && (d.memoizedState = e, dh = !0);
		d = d.queue;
		$h(ai.bind(null, c, d, a), [a]);
		if (d.getSnapshot !== b$1 || f$2 || null !== O$1 && O$1.memoizedState.tag & 1) {
			c.flags |= 2048;
			bi(9, ci.bind(null, c, d, e, b$1), void 0, null);
			if (null === Q) throw Error(p$1(349));
			0 !== (Hh & 30) || di(c, b$1, e);
		}
		return e;
	}
	function di(a, b$1, c) {
		a.flags |= 16384;
		a = {
			getSnapshot: b$1,
			value: c
		};
		b$1 = M$1.updateQueue;
		null === b$1 ? (b$1 = {
			lastEffect: null,
			stores: null
		}, M$1.updateQueue = b$1, b$1.stores = [a]) : (c = b$1.stores, null === c ? b$1.stores = [a] : c.push(a));
	}
	function ci(a, b$1, c, d) {
		b$1.value = c;
		b$1.getSnapshot = d;
		ei(b$1) && fi(a);
	}
	function ai(a, b$1, c) {
		return c(function() {
			ei(b$1) && fi(a);
		});
	}
	function ei(a) {
		var b$1 = a.getSnapshot;
		a = a.value;
		try {
			var c = b$1();
			return !He(a, c);
		} catch (d) {
			return !0;
		}
	}
	function fi(a) {
		var b$1 = ih(a, 1);
		null !== b$1 && gi(b$1, a, 1, -1);
	}
	function hi(a) {
		var b$1 = Th();
		"function" === typeof a && (a = a());
		b$1.memoizedState = b$1.baseState = a;
		a = {
			pending: null,
			interleaved: null,
			lanes: 0,
			dispatch: null,
			lastRenderedReducer: Vh,
			lastRenderedState: a
		};
		b$1.queue = a;
		a = a.dispatch = ii.bind(null, M$1, a);
		return [b$1.memoizedState, a];
	}
	function bi(a, b$1, c, d) {
		a = {
			tag: a,
			create: b$1,
			destroy: c,
			deps: d,
			next: null
		};
		b$1 = M$1.updateQueue;
		null === b$1 ? (b$1 = {
			lastEffect: null,
			stores: null
		}, M$1.updateQueue = b$1, b$1.lastEffect = a.next = a) : (c = b$1.lastEffect, null === c ? b$1.lastEffect = a.next = a : (d = c.next, c.next = a, a.next = d, b$1.lastEffect = a));
		return a;
	}
	function ji() {
		return Uh().memoizedState;
	}
	function ki(a, b$1, c, d) {
		var e = Th();
		M$1.flags |= a;
		e.memoizedState = bi(1 | b$1, c, void 0, void 0 === d ? null : d);
	}
	function li(a, b$1, c, d) {
		var e = Uh();
		d = void 0 === d ? null : d;
		var f$2 = void 0;
		if (null !== N$1) {
			var g$2 = N$1.memoizedState;
			f$2 = g$2.destroy;
			if (null !== d && Mh(d, g$2.deps)) {
				e.memoizedState = bi(b$1, c, f$2, d);
				return;
			}
		}
		M$1.flags |= a;
		e.memoizedState = bi(1 | b$1, c, f$2, d);
	}
	function mi(a, b$1) {
		return ki(8390656, 8, a, b$1);
	}
	function $h(a, b$1) {
		return li(2048, 8, a, b$1);
	}
	function ni(a, b$1) {
		return li(4, 2, a, b$1);
	}
	function oi(a, b$1) {
		return li(4, 4, a, b$1);
	}
	function pi(a, b$1) {
		if ("function" === typeof b$1) return a = a(), b$1(a), function() {
			b$1(null);
		};
		if (null !== b$1 && void 0 !== b$1) return a = a(), b$1.current = a, function() {
			b$1.current = null;
		};
	}
	function qi(a, b$1, c) {
		c = null !== c && void 0 !== c ? c.concat([a]) : null;
		return li(4, 4, pi.bind(null, b$1, a), c);
	}
	function ri() {}
	function si(a, b$1) {
		var c = Uh();
		b$1 = void 0 === b$1 ? null : b$1;
		var d = c.memoizedState;
		if (null !== d && null !== b$1 && Mh(b$1, d[1])) return d[0];
		c.memoizedState = [a, b$1];
		return a;
	}
	function ti(a, b$1) {
		var c = Uh();
		b$1 = void 0 === b$1 ? null : b$1;
		var d = c.memoizedState;
		if (null !== d && null !== b$1 && Mh(b$1, d[1])) return d[0];
		a = a();
		c.memoizedState = [a, b$1];
		return a;
	}
	function ui(a, b$1, c) {
		if (0 === (Hh & 21)) return a.baseState && (a.baseState = !1, dh = !0), a.memoizedState = c;
		He(c, b$1) || (c = yc(), M$1.lanes |= c, rh |= c, a.baseState = !0);
		return b$1;
	}
	function vi(a, b$1) {
		var c = C;
		C = 0 !== c && 4 > c ? c : 4;
		a(!0);
		var d = Gh.transition;
		Gh.transition = {};
		try {
			a(!1), b$1();
		} finally {
			C = c, Gh.transition = d;
		}
	}
	function wi() {
		return Uh().memoizedState;
	}
	function xi(a, b$1, c) {
		var d = yi(a);
		c = {
			lane: d,
			action: c,
			hasEagerState: !1,
			eagerState: null,
			next: null
		};
		if (zi(a)) Ai(b$1, c);
		else if (c = hh(a, b$1, c, d), null !== c) {
			var e = R();
			gi(c, a, d, e);
			Bi(c, b$1, d);
		}
	}
	function ii(a, b$1, c) {
		var d = yi(a), e = {
			lane: d,
			action: c,
			hasEagerState: !1,
			eagerState: null,
			next: null
		};
		if (zi(a)) Ai(b$1, e);
		else {
			var f$2 = a.alternate;
			if (0 === a.lanes && (null === f$2 || 0 === f$2.lanes) && (f$2 = b$1.lastRenderedReducer, null !== f$2)) try {
				var g$2 = b$1.lastRenderedState, h$1 = f$2(g$2, c);
				e.hasEagerState = !0;
				e.eagerState = h$1;
				if (He(h$1, g$2)) {
					var k$2 = b$1.interleaved;
					null === k$2 ? (e.next = e, gh(b$1)) : (e.next = k$2.next, k$2.next = e);
					b$1.interleaved = e;
					return;
				}
			} catch (l$3) {}
			c = hh(a, b$1, e, d);
			null !== c && (e = R(), gi(c, a, d, e), Bi(c, b$1, d));
		}
	}
	function zi(a) {
		var b$1 = a.alternate;
		return a === M$1 || null !== b$1 && b$1 === M$1;
	}
	function Ai(a, b$1) {
		Jh = Ih = !0;
		var c = a.pending;
		null === c ? b$1.next = b$1 : (b$1.next = c.next, c.next = b$1);
		a.pending = b$1;
	}
	function Bi(a, b$1, c) {
		if (0 !== (c & 4194240)) {
			var d = b$1.lanes;
			d &= a.pendingLanes;
			c |= d;
			b$1.lanes = c;
			Cc(a, c);
		}
	}
	var Rh = {
		readContext: eh,
		useCallback: P,
		useContext: P,
		useEffect: P,
		useImperativeHandle: P,
		useInsertionEffect: P,
		useLayoutEffect: P,
		useMemo: P,
		useReducer: P,
		useRef: P,
		useState: P,
		useDebugValue: P,
		useDeferredValue: P,
		useTransition: P,
		useMutableSource: P,
		useSyncExternalStore: P,
		useId: P,
		unstable_isNewReconciler: !1
	}, Oh = {
		readContext: eh,
		useCallback: function(a, b$1) {
			Th().memoizedState = [a, void 0 === b$1 ? null : b$1];
			return a;
		},
		useContext: eh,
		useEffect: mi,
		useImperativeHandle: function(a, b$1, c) {
			c = null !== c && void 0 !== c ? c.concat([a]) : null;
			return ki(4194308, 4, pi.bind(null, b$1, a), c);
		},
		useLayoutEffect: function(a, b$1) {
			return ki(4194308, 4, a, b$1);
		},
		useInsertionEffect: function(a, b$1) {
			return ki(4, 2, a, b$1);
		},
		useMemo: function(a, b$1) {
			var c = Th();
			b$1 = void 0 === b$1 ? null : b$1;
			a = a();
			c.memoizedState = [a, b$1];
			return a;
		},
		useReducer: function(a, b$1, c) {
			var d = Th();
			b$1 = void 0 !== c ? c(b$1) : b$1;
			d.memoizedState = d.baseState = b$1;
			a = {
				pending: null,
				interleaved: null,
				lanes: 0,
				dispatch: null,
				lastRenderedReducer: a,
				lastRenderedState: b$1
			};
			d.queue = a;
			a = a.dispatch = xi.bind(null, M$1, a);
			return [d.memoizedState, a];
		},
		useRef: function(a) {
			var b$1 = Th();
			a = { current: a };
			return b$1.memoizedState = a;
		},
		useState: hi,
		useDebugValue: ri,
		useDeferredValue: function(a) {
			return Th().memoizedState = a;
		},
		useTransition: function() {
			var a = hi(!1), b$1 = a[0];
			a = vi.bind(null, a[1]);
			Th().memoizedState = a;
			return [b$1, a];
		},
		useMutableSource: function() {},
		useSyncExternalStore: function(a, b$1, c) {
			var d = M$1, e = Th();
			if (I$1) {
				if (void 0 === c) throw Error(p$1(407));
				c = c();
			} else {
				c = b$1();
				if (null === Q) throw Error(p$1(349));
				0 !== (Hh & 30) || di(d, b$1, c);
			}
			e.memoizedState = c;
			var f$2 = {
				value: c,
				getSnapshot: b$1
			};
			e.queue = f$2;
			mi(ai.bind(null, d, f$2, a), [a]);
			d.flags |= 2048;
			bi(9, ci.bind(null, d, f$2, c, b$1), void 0, null);
			return c;
		},
		useId: function() {
			var a = Th(), b$1 = Q.identifierPrefix;
			if (I$1) {
				var c = sg;
				var d = rg;
				c = (d & ~(1 << 32 - oc(d) - 1)).toString(32) + c;
				b$1 = ":" + b$1 + "R" + c;
				c = Kh++;
				0 < c && (b$1 += "H" + c.toString(32));
				b$1 += ":";
			} else c = Lh++, b$1 = ":" + b$1 + "r" + c.toString(32) + ":";
			return a.memoizedState = b$1;
		},
		unstable_isNewReconciler: !1
	}, Ph = {
		readContext: eh,
		useCallback: si,
		useContext: eh,
		useEffect: $h,
		useImperativeHandle: qi,
		useInsertionEffect: ni,
		useLayoutEffect: oi,
		useMemo: ti,
		useReducer: Wh,
		useRef: ji,
		useState: function() {
			return Wh(Vh);
		},
		useDebugValue: ri,
		useDeferredValue: function(a) {
			return ui(Uh(), N$1.memoizedState, a);
		},
		useTransition: function() {
			return [Wh(Vh)[0], Uh().memoizedState];
		},
		useMutableSource: Yh,
		useSyncExternalStore: Zh,
		useId: wi,
		unstable_isNewReconciler: !1
	}, Qh = {
		readContext: eh,
		useCallback: si,
		useContext: eh,
		useEffect: $h,
		useImperativeHandle: qi,
		useInsertionEffect: ni,
		useLayoutEffect: oi,
		useMemo: ti,
		useReducer: Xh,
		useRef: ji,
		useState: function() {
			return Xh(Vh);
		},
		useDebugValue: ri,
		useDeferredValue: function(a) {
			var b$1 = Uh();
			return null === N$1 ? b$1.memoizedState = a : ui(b$1, N$1.memoizedState, a);
		},
		useTransition: function() {
			return [Xh(Vh)[0], Uh().memoizedState];
		},
		useMutableSource: Yh,
		useSyncExternalStore: Zh,
		useId: wi,
		unstable_isNewReconciler: !1
	};
	function Ci(a, b$1) {
		if (a && a.defaultProps) {
			b$1 = A({}, b$1);
			a = a.defaultProps;
			for (var c in a) void 0 === b$1[c] && (b$1[c] = a[c]);
			return b$1;
		}
		return b$1;
	}
	function Di(a, b$1, c, d) {
		b$1 = a.memoizedState;
		c = c(d, b$1);
		c = null === c || void 0 === c ? b$1 : A({}, b$1, c);
		a.memoizedState = c;
		0 === a.lanes && (a.updateQueue.baseState = c);
	}
	var Ei = {
		isMounted: function(a) {
			return (a = a._reactInternals) ? Vb(a) === a : !1;
		},
		enqueueSetState: function(a, b$1, c) {
			a = a._reactInternals;
			var d = R(), e = yi(a), f$2 = mh(d, e);
			f$2.payload = b$1;
			void 0 !== c && null !== c && (f$2.callback = c);
			b$1 = nh(a, f$2, e);
			null !== b$1 && (gi(b$1, a, e, d), oh(b$1, a, e));
		},
		enqueueReplaceState: function(a, b$1, c) {
			a = a._reactInternals;
			var d = R(), e = yi(a), f$2 = mh(d, e);
			f$2.tag = 1;
			f$2.payload = b$1;
			void 0 !== c && null !== c && (f$2.callback = c);
			b$1 = nh(a, f$2, e);
			null !== b$1 && (gi(b$1, a, e, d), oh(b$1, a, e));
		},
		enqueueForceUpdate: function(a, b$1) {
			a = a._reactInternals;
			var c = R(), d = yi(a), e = mh(c, d);
			e.tag = 2;
			void 0 !== b$1 && null !== b$1 && (e.callback = b$1);
			b$1 = nh(a, e, d);
			null !== b$1 && (gi(b$1, a, d, c), oh(b$1, a, d));
		}
	};
	function Fi(a, b$1, c, d, e, f$2, g$2) {
		a = a.stateNode;
		return "function" === typeof a.shouldComponentUpdate ? a.shouldComponentUpdate(d, f$2, g$2) : b$1.prototype && b$1.prototype.isPureReactComponent ? !Ie(c, d) || !Ie(e, f$2) : !0;
	}
	function Gi(a, b$1, c) {
		var d = !1, e = Vf;
		var f$2 = b$1.contextType;
		"object" === typeof f$2 && null !== f$2 ? f$2 = eh(f$2) : (e = Zf(b$1) ? Xf : H$1.current, d = b$1.contextTypes, f$2 = (d = null !== d && void 0 !== d) ? Yf(a, e) : Vf);
		b$1 = new b$1(c, f$2);
		a.memoizedState = null !== b$1.state && void 0 !== b$1.state ? b$1.state : null;
		b$1.updater = Ei;
		a.stateNode = b$1;
		b$1._reactInternals = a;
		d && (a = a.stateNode, a.__reactInternalMemoizedUnmaskedChildContext = e, a.__reactInternalMemoizedMaskedChildContext = f$2);
		return b$1;
	}
	function Hi(a, b$1, c, d) {
		a = b$1.state;
		"function" === typeof b$1.componentWillReceiveProps && b$1.componentWillReceiveProps(c, d);
		"function" === typeof b$1.UNSAFE_componentWillReceiveProps && b$1.UNSAFE_componentWillReceiveProps(c, d);
		b$1.state !== a && Ei.enqueueReplaceState(b$1, b$1.state, null);
	}
	function Ii(a, b$1, c, d) {
		var e = a.stateNode;
		e.props = c;
		e.state = a.memoizedState;
		e.refs = {};
		kh(a);
		var f$2 = b$1.contextType;
		"object" === typeof f$2 && null !== f$2 ? e.context = eh(f$2) : (f$2 = Zf(b$1) ? Xf : H$1.current, e.context = Yf(a, f$2));
		e.state = a.memoizedState;
		f$2 = b$1.getDerivedStateFromProps;
		"function" === typeof f$2 && (Di(a, b$1, f$2, c), e.state = a.memoizedState);
		"function" === typeof b$1.getDerivedStateFromProps || "function" === typeof e.getSnapshotBeforeUpdate || "function" !== typeof e.UNSAFE_componentWillMount && "function" !== typeof e.componentWillMount || (b$1 = e.state, "function" === typeof e.componentWillMount && e.componentWillMount(), "function" === typeof e.UNSAFE_componentWillMount && e.UNSAFE_componentWillMount(), b$1 !== e.state && Ei.enqueueReplaceState(e, e.state, null), qh(a, c, e, d), e.state = a.memoizedState);
		"function" === typeof e.componentDidMount && (a.flags |= 4194308);
	}
	function Ji(a, b$1) {
		try {
			var c = "", d = b$1;
			do
				c += Pa(d), d = d.return;
			while (d);
			var e = c;
		} catch (f$2) {
			e = "\nError generating stack: " + f$2.message + "\n" + f$2.stack;
		}
		return {
			value: a,
			source: b$1,
			stack: e,
			digest: null
		};
	}
	function Ki(a, b$1, c) {
		return {
			value: a,
			source: null,
			stack: null != c ? c : null,
			digest: null != b$1 ? b$1 : null
		};
	}
	function Li(a, b$1) {
		try {
			console.error(b$1.value);
		} catch (c) {
			setTimeout(function() {
				throw c;
			});
		}
	}
	var Mi = "function" === typeof WeakMap ? WeakMap : Map;
	function Ni(a, b$1, c) {
		c = mh(-1, c);
		c.tag = 3;
		c.payload = { element: null };
		var d = b$1.value;
		c.callback = function() {
			Oi || (Oi = !0, Pi = d);
			Li(a, b$1);
		};
		return c;
	}
	function Qi(a, b$1, c) {
		c = mh(-1, c);
		c.tag = 3;
		var d = a.type.getDerivedStateFromError;
		if ("function" === typeof d) {
			var e = b$1.value;
			c.payload = function() {
				return d(e);
			};
			c.callback = function() {
				Li(a, b$1);
			};
		}
		var f$2 = a.stateNode;
		null !== f$2 && "function" === typeof f$2.componentDidCatch && (c.callback = function() {
			Li(a, b$1);
			"function" !== typeof d && (null === Ri ? Ri = new Set([this]) : Ri.add(this));
			var c$1 = b$1.stack;
			this.componentDidCatch(b$1.value, { componentStack: null !== c$1 ? c$1 : "" });
		});
		return c;
	}
	function Si(a, b$1, c) {
		var d = a.pingCache;
		if (null === d) {
			d = a.pingCache = new Mi();
			var e = /* @__PURE__ */ new Set();
			d.set(b$1, e);
		} else e = d.get(b$1), void 0 === e && (e = /* @__PURE__ */ new Set(), d.set(b$1, e));
		e.has(c) || (e.add(c), a = Ti.bind(null, a, b$1, c), b$1.then(a, a));
	}
	function Ui(a) {
		do {
			var b$1;
			if (b$1 = 13 === a.tag) b$1 = a.memoizedState, b$1 = null !== b$1 ? null !== b$1.dehydrated ? !0 : !1 : !0;
			if (b$1) return a;
			a = a.return;
		} while (null !== a);
		return null;
	}
	function Vi(a, b$1, c, d, e) {
		if (0 === (a.mode & 1)) return a === b$1 ? a.flags |= 65536 : (a.flags |= 128, c.flags |= 131072, c.flags &= -52805, 1 === c.tag && (null === c.alternate ? c.tag = 17 : (b$1 = mh(-1, 1), b$1.tag = 2, nh(c, b$1, 1))), c.lanes |= 1), a;
		a.flags |= 65536;
		a.lanes = e;
		return a;
	}
	var Wi = ua.ReactCurrentOwner, dh = !1;
	function Xi(a, b$1, c, d) {
		b$1.child = null === a ? Vg(b$1, null, c, d) : Ug(b$1, a.child, c, d);
	}
	function Yi(a, b$1, c, d, e) {
		c = c.render;
		var f$2 = b$1.ref;
		ch(b$1, e);
		d = Nh(a, b$1, c, d, f$2, e);
		c = Sh();
		if (null !== a && !dh) return b$1.updateQueue = a.updateQueue, b$1.flags &= -2053, a.lanes &= ~e, Zi(a, b$1, e);
		I$1 && c && vg(b$1);
		b$1.flags |= 1;
		Xi(a, b$1, d, e);
		return b$1.child;
	}
	function $i(a, b$1, c, d, e) {
		if (null === a) {
			var f$2 = c.type;
			if ("function" === typeof f$2 && !aj(f$2) && void 0 === f$2.defaultProps && null === c.compare && void 0 === c.defaultProps) return b$1.tag = 15, b$1.type = f$2, bj(a, b$1, f$2, d, e);
			a = Rg(c.type, null, d, b$1, b$1.mode, e);
			a.ref = b$1.ref;
			a.return = b$1;
			return b$1.child = a;
		}
		f$2 = a.child;
		if (0 === (a.lanes & e)) {
			var g$2 = f$2.memoizedProps;
			c = c.compare;
			c = null !== c ? c : Ie;
			if (c(g$2, d) && a.ref === b$1.ref) return Zi(a, b$1, e);
		}
		b$1.flags |= 1;
		a = Pg(f$2, d);
		a.ref = b$1.ref;
		a.return = b$1;
		return b$1.child = a;
	}
	function bj(a, b$1, c, d, e) {
		if (null !== a) {
			var f$2 = a.memoizedProps;
			if (Ie(f$2, d) && a.ref === b$1.ref) if (dh = !1, b$1.pendingProps = d = f$2, 0 !== (a.lanes & e)) 0 !== (a.flags & 131072) && (dh = !0);
			else return b$1.lanes = a.lanes, Zi(a, b$1, e);
		}
		return cj(a, b$1, c, d, e);
	}
	function dj(a, b$1, c) {
		var d = b$1.pendingProps, e = d.children, f$2 = null !== a ? a.memoizedState : null;
		if ("hidden" === d.mode) if (0 === (b$1.mode & 1)) b$1.memoizedState = {
			baseLanes: 0,
			cachePool: null,
			transitions: null
		}, G(ej, fj), fj |= c;
		else {
			if (0 === (c & 1073741824)) return a = null !== f$2 ? f$2.baseLanes | c : c, b$1.lanes = b$1.childLanes = 1073741824, b$1.memoizedState = {
				baseLanes: a,
				cachePool: null,
				transitions: null
			}, b$1.updateQueue = null, G(ej, fj), fj |= a, null;
			b$1.memoizedState = {
				baseLanes: 0,
				cachePool: null,
				transitions: null
			};
			d = null !== f$2 ? f$2.baseLanes : c;
			G(ej, fj);
			fj |= d;
		}
		else null !== f$2 ? (d = f$2.baseLanes | c, b$1.memoizedState = null) : d = c, G(ej, fj), fj |= d;
		Xi(a, b$1, e, c);
		return b$1.child;
	}
	function gj(a, b$1) {
		var c = b$1.ref;
		if (null === a && null !== c || null !== a && a.ref !== c) b$1.flags |= 512, b$1.flags |= 2097152;
	}
	function cj(a, b$1, c, d, e) {
		var f$2 = Zf(c) ? Xf : H$1.current;
		f$2 = Yf(b$1, f$2);
		ch(b$1, e);
		c = Nh(a, b$1, c, d, f$2, e);
		d = Sh();
		if (null !== a && !dh) return b$1.updateQueue = a.updateQueue, b$1.flags &= -2053, a.lanes &= ~e, Zi(a, b$1, e);
		I$1 && d && vg(b$1);
		b$1.flags |= 1;
		Xi(a, b$1, c, e);
		return b$1.child;
	}
	function hj(a, b$1, c, d, e) {
		if (Zf(c)) {
			var f$2 = !0;
			cg(b$1);
		} else f$2 = !1;
		ch(b$1, e);
		if (null === b$1.stateNode) ij(a, b$1), Gi(b$1, c, d), Ii(b$1, c, d, e), d = !0;
		else if (null === a) {
			var g$2 = b$1.stateNode, h$1 = b$1.memoizedProps;
			g$2.props = h$1;
			var k$2 = g$2.context, l$3 = c.contextType;
			"object" === typeof l$3 && null !== l$3 ? l$3 = eh(l$3) : (l$3 = Zf(c) ? Xf : H$1.current, l$3 = Yf(b$1, l$3));
			var m$2 = c.getDerivedStateFromProps, q$3 = "function" === typeof m$2 || "function" === typeof g$2.getSnapshotBeforeUpdate;
			q$3 || "function" !== typeof g$2.UNSAFE_componentWillReceiveProps && "function" !== typeof g$2.componentWillReceiveProps || (h$1 !== d || k$2 !== l$3) && Hi(b$1, g$2, d, l$3);
			jh = !1;
			var r$3 = b$1.memoizedState;
			g$2.state = r$3;
			qh(b$1, d, g$2, e);
			k$2 = b$1.memoizedState;
			h$1 !== d || r$3 !== k$2 || Wf.current || jh ? ("function" === typeof m$2 && (Di(b$1, c, m$2, d), k$2 = b$1.memoizedState), (h$1 = jh || Fi(b$1, c, h$1, d, r$3, k$2, l$3)) ? (q$3 || "function" !== typeof g$2.UNSAFE_componentWillMount && "function" !== typeof g$2.componentWillMount || ("function" === typeof g$2.componentWillMount && g$2.componentWillMount(), "function" === typeof g$2.UNSAFE_componentWillMount && g$2.UNSAFE_componentWillMount()), "function" === typeof g$2.componentDidMount && (b$1.flags |= 4194308)) : ("function" === typeof g$2.componentDidMount && (b$1.flags |= 4194308), b$1.memoizedProps = d, b$1.memoizedState = k$2), g$2.props = d, g$2.state = k$2, g$2.context = l$3, d = h$1) : ("function" === typeof g$2.componentDidMount && (b$1.flags |= 4194308), d = !1);
		} else {
			g$2 = b$1.stateNode;
			lh(a, b$1);
			h$1 = b$1.memoizedProps;
			l$3 = b$1.type === b$1.elementType ? h$1 : Ci(b$1.type, h$1);
			g$2.props = l$3;
			q$3 = b$1.pendingProps;
			r$3 = g$2.context;
			k$2 = c.contextType;
			"object" === typeof k$2 && null !== k$2 ? k$2 = eh(k$2) : (k$2 = Zf(c) ? Xf : H$1.current, k$2 = Yf(b$1, k$2));
			var y$2 = c.getDerivedStateFromProps;
			(m$2 = "function" === typeof y$2 || "function" === typeof g$2.getSnapshotBeforeUpdate) || "function" !== typeof g$2.UNSAFE_componentWillReceiveProps && "function" !== typeof g$2.componentWillReceiveProps || (h$1 !== q$3 || r$3 !== k$2) && Hi(b$1, g$2, d, k$2);
			jh = !1;
			r$3 = b$1.memoizedState;
			g$2.state = r$3;
			qh(b$1, d, g$2, e);
			var n$2 = b$1.memoizedState;
			h$1 !== q$3 || r$3 !== n$2 || Wf.current || jh ? ("function" === typeof y$2 && (Di(b$1, c, y$2, d), n$2 = b$1.memoizedState), (l$3 = jh || Fi(b$1, c, l$3, d, r$3, n$2, k$2) || !1) ? (m$2 || "function" !== typeof g$2.UNSAFE_componentWillUpdate && "function" !== typeof g$2.componentWillUpdate || ("function" === typeof g$2.componentWillUpdate && g$2.componentWillUpdate(d, n$2, k$2), "function" === typeof g$2.UNSAFE_componentWillUpdate && g$2.UNSAFE_componentWillUpdate(d, n$2, k$2)), "function" === typeof g$2.componentDidUpdate && (b$1.flags |= 4), "function" === typeof g$2.getSnapshotBeforeUpdate && (b$1.flags |= 1024)) : ("function" !== typeof g$2.componentDidUpdate || h$1 === a.memoizedProps && r$3 === a.memoizedState || (b$1.flags |= 4), "function" !== typeof g$2.getSnapshotBeforeUpdate || h$1 === a.memoizedProps && r$3 === a.memoizedState || (b$1.flags |= 1024), b$1.memoizedProps = d, b$1.memoizedState = n$2), g$2.props = d, g$2.state = n$2, g$2.context = k$2, d = l$3) : ("function" !== typeof g$2.componentDidUpdate || h$1 === a.memoizedProps && r$3 === a.memoizedState || (b$1.flags |= 4), "function" !== typeof g$2.getSnapshotBeforeUpdate || h$1 === a.memoizedProps && r$3 === a.memoizedState || (b$1.flags |= 1024), d = !1);
		}
		return jj(a, b$1, c, d, f$2, e);
	}
	function jj(a, b$1, c, d, e, f$2) {
		gj(a, b$1);
		var g$2 = 0 !== (b$1.flags & 128);
		if (!d && !g$2) return e && dg(b$1, c, !1), Zi(a, b$1, f$2);
		d = b$1.stateNode;
		Wi.current = b$1;
		var h$1 = g$2 && "function" !== typeof c.getDerivedStateFromError ? null : d.render();
		b$1.flags |= 1;
		null !== a && g$2 ? (b$1.child = Ug(b$1, a.child, null, f$2), b$1.child = Ug(b$1, null, h$1, f$2)) : Xi(a, b$1, h$1, f$2);
		b$1.memoizedState = d.state;
		e && dg(b$1, c, !0);
		return b$1.child;
	}
	function kj(a) {
		var b$1 = a.stateNode;
		b$1.pendingContext ? ag(a, b$1.pendingContext, b$1.pendingContext !== b$1.context) : b$1.context && ag(a, b$1.context, !1);
		yh(a, b$1.containerInfo);
	}
	function lj(a, b$1, c, d, e) {
		Ig();
		Jg(e);
		b$1.flags |= 256;
		Xi(a, b$1, c, d);
		return b$1.child;
	}
	var mj = {
		dehydrated: null,
		treeContext: null,
		retryLane: 0
	};
	function nj(a) {
		return {
			baseLanes: a,
			cachePool: null,
			transitions: null
		};
	}
	function oj(a, b$1, c) {
		var d = b$1.pendingProps, e = L.current, f$2 = !1, g$2 = 0 !== (b$1.flags & 128), h$1;
		(h$1 = g$2) || (h$1 = null !== a && null === a.memoizedState ? !1 : 0 !== (e & 2));
		if (h$1) f$2 = !0, b$1.flags &= -129;
		else if (null === a || null !== a.memoizedState) e |= 1;
		G(L, e & 1);
		if (null === a) {
			Eg(b$1);
			a = b$1.memoizedState;
			if (null !== a && (a = a.dehydrated, null !== a)) return 0 === (b$1.mode & 1) ? b$1.lanes = 1 : "$!" === a.data ? b$1.lanes = 8 : b$1.lanes = 1073741824, null;
			g$2 = d.children;
			a = d.fallback;
			return f$2 ? (d = b$1.mode, f$2 = b$1.child, g$2 = {
				mode: "hidden",
				children: g$2
			}, 0 === (d & 1) && null !== f$2 ? (f$2.childLanes = 0, f$2.pendingProps = g$2) : f$2 = pj(g$2, d, 0, null), a = Tg(a, d, c, null), f$2.return = b$1, a.return = b$1, f$2.sibling = a, b$1.child = f$2, b$1.child.memoizedState = nj(c), b$1.memoizedState = mj, a) : qj(b$1, g$2);
		}
		e = a.memoizedState;
		if (null !== e && (h$1 = e.dehydrated, null !== h$1)) return rj(a, b$1, g$2, d, h$1, e, c);
		if (f$2) {
			f$2 = d.fallback;
			g$2 = b$1.mode;
			e = a.child;
			h$1 = e.sibling;
			var k$2 = {
				mode: "hidden",
				children: d.children
			};
			0 === (g$2 & 1) && b$1.child !== e ? (d = b$1.child, d.childLanes = 0, d.pendingProps = k$2, b$1.deletions = null) : (d = Pg(e, k$2), d.subtreeFlags = e.subtreeFlags & 14680064);
			null !== h$1 ? f$2 = Pg(h$1, f$2) : (f$2 = Tg(f$2, g$2, c, null), f$2.flags |= 2);
			f$2.return = b$1;
			d.return = b$1;
			d.sibling = f$2;
			b$1.child = d;
			d = f$2;
			f$2 = b$1.child;
			g$2 = a.child.memoizedState;
			g$2 = null === g$2 ? nj(c) : {
				baseLanes: g$2.baseLanes | c,
				cachePool: null,
				transitions: g$2.transitions
			};
			f$2.memoizedState = g$2;
			f$2.childLanes = a.childLanes & ~c;
			b$1.memoizedState = mj;
			return d;
		}
		f$2 = a.child;
		a = f$2.sibling;
		d = Pg(f$2, {
			mode: "visible",
			children: d.children
		});
		0 === (b$1.mode & 1) && (d.lanes = c);
		d.return = b$1;
		d.sibling = null;
		null !== a && (c = b$1.deletions, null === c ? (b$1.deletions = [a], b$1.flags |= 16) : c.push(a));
		b$1.child = d;
		b$1.memoizedState = null;
		return d;
	}
	function qj(a, b$1) {
		b$1 = pj({
			mode: "visible",
			children: b$1
		}, a.mode, 0, null);
		b$1.return = a;
		return a.child = b$1;
	}
	function sj(a, b$1, c, d) {
		null !== d && Jg(d);
		Ug(b$1, a.child, null, c);
		a = qj(b$1, b$1.pendingProps.children);
		a.flags |= 2;
		b$1.memoizedState = null;
		return a;
	}
	function rj(a, b$1, c, d, e, f$2, g$2) {
		if (c) {
			if (b$1.flags & 256) return b$1.flags &= -257, d = Ki(Error(p$1(422))), sj(a, b$1, g$2, d);
			if (null !== b$1.memoizedState) return b$1.child = a.child, b$1.flags |= 128, null;
			f$2 = d.fallback;
			e = b$1.mode;
			d = pj({
				mode: "visible",
				children: d.children
			}, e, 0, null);
			f$2 = Tg(f$2, e, g$2, null);
			f$2.flags |= 2;
			d.return = b$1;
			f$2.return = b$1;
			d.sibling = f$2;
			b$1.child = d;
			0 !== (b$1.mode & 1) && Ug(b$1, a.child, null, g$2);
			b$1.child.memoizedState = nj(g$2);
			b$1.memoizedState = mj;
			return f$2;
		}
		if (0 === (b$1.mode & 1)) return sj(a, b$1, g$2, null);
		if ("$!" === e.data) {
			d = e.nextSibling && e.nextSibling.dataset;
			if (d) var h$1 = d.dgst;
			d = h$1;
			f$2 = Error(p$1(419));
			d = Ki(f$2, d, void 0);
			return sj(a, b$1, g$2, d);
		}
		h$1 = 0 !== (g$2 & a.childLanes);
		if (dh || h$1) {
			d = Q;
			if (null !== d) {
				switch (g$2 & -g$2) {
					case 4:
						e = 2;
						break;
					case 16:
						e = 8;
						break;
					case 64:
					case 128:
					case 256:
					case 512:
					case 1024:
					case 2048:
					case 4096:
					case 8192:
					case 16384:
					case 32768:
					case 65536:
					case 131072:
					case 262144:
					case 524288:
					case 1048576:
					case 2097152:
					case 4194304:
					case 8388608:
					case 16777216:
					case 33554432:
					case 67108864:
						e = 32;
						break;
					case 536870912:
						e = 268435456;
						break;
					default: e = 0;
				}
				e = 0 !== (e & (d.suspendedLanes | g$2)) ? 0 : e;
				0 !== e && e !== f$2.retryLane && (f$2.retryLane = e, ih(a, e), gi(d, a, e, -1));
			}
			tj();
			d = Ki(Error(p$1(421)));
			return sj(a, b$1, g$2, d);
		}
		if ("$?" === e.data) return b$1.flags |= 128, b$1.child = a.child, b$1 = uj.bind(null, a), e._reactRetry = b$1, null;
		a = f$2.treeContext;
		yg = Lf(e.nextSibling);
		xg = b$1;
		I$1 = !0;
		zg = null;
		null !== a && (og[pg++] = rg, og[pg++] = sg, og[pg++] = qg, rg = a.id, sg = a.overflow, qg = b$1);
		b$1 = qj(b$1, d.children);
		b$1.flags |= 4096;
		return b$1;
	}
	function vj(a, b$1, c) {
		a.lanes |= b$1;
		var d = a.alternate;
		null !== d && (d.lanes |= b$1);
		bh(a.return, b$1, c);
	}
	function wj(a, b$1, c, d, e) {
		var f$2 = a.memoizedState;
		null === f$2 ? a.memoizedState = {
			isBackwards: b$1,
			rendering: null,
			renderingStartTime: 0,
			last: d,
			tail: c,
			tailMode: e
		} : (f$2.isBackwards = b$1, f$2.rendering = null, f$2.renderingStartTime = 0, f$2.last = d, f$2.tail = c, f$2.tailMode = e);
	}
	function xj(a, b$1, c) {
		var d = b$1.pendingProps, e = d.revealOrder, f$2 = d.tail;
		Xi(a, b$1, d.children, c);
		d = L.current;
		if (0 !== (d & 2)) d = d & 1 | 2, b$1.flags |= 128;
		else {
			if (null !== a && 0 !== (a.flags & 128)) a: for (a = b$1.child; null !== a;) {
				if (13 === a.tag) null !== a.memoizedState && vj(a, c, b$1);
				else if (19 === a.tag) vj(a, c, b$1);
				else if (null !== a.child) {
					a.child.return = a;
					a = a.child;
					continue;
				}
				if (a === b$1) break a;
				for (; null === a.sibling;) {
					if (null === a.return || a.return === b$1) break a;
					a = a.return;
				}
				a.sibling.return = a.return;
				a = a.sibling;
			}
			d &= 1;
		}
		G(L, d);
		if (0 === (b$1.mode & 1)) b$1.memoizedState = null;
		else switch (e) {
			case "forwards":
				c = b$1.child;
				for (e = null; null !== c;) a = c.alternate, null !== a && null === Ch(a) && (e = c), c = c.sibling;
				c = e;
				null === c ? (e = b$1.child, b$1.child = null) : (e = c.sibling, c.sibling = null);
				wj(b$1, !1, e, c, f$2);
				break;
			case "backwards":
				c = null;
				e = b$1.child;
				for (b$1.child = null; null !== e;) {
					a = e.alternate;
					if (null !== a && null === Ch(a)) {
						b$1.child = e;
						break;
					}
					a = e.sibling;
					e.sibling = c;
					c = e;
					e = a;
				}
				wj(b$1, !0, c, null, f$2);
				break;
			case "together":
				wj(b$1, !1, null, null, void 0);
				break;
			default: b$1.memoizedState = null;
		}
		return b$1.child;
	}
	function ij(a, b$1) {
		0 === (b$1.mode & 1) && null !== a && (a.alternate = null, b$1.alternate = null, b$1.flags |= 2);
	}
	function Zi(a, b$1, c) {
		null !== a && (b$1.dependencies = a.dependencies);
		rh |= b$1.lanes;
		if (0 === (c & b$1.childLanes)) return null;
		if (null !== a && b$1.child !== a.child) throw Error(p$1(153));
		if (null !== b$1.child) {
			a = b$1.child;
			c = Pg(a, a.pendingProps);
			b$1.child = c;
			for (c.return = b$1; null !== a.sibling;) a = a.sibling, c = c.sibling = Pg(a, a.pendingProps), c.return = b$1;
			c.sibling = null;
		}
		return b$1.child;
	}
	function yj(a, b$1, c) {
		switch (b$1.tag) {
			case 3:
				kj(b$1);
				Ig();
				break;
			case 5:
				Ah(b$1);
				break;
			case 1:
				Zf(b$1.type) && cg(b$1);
				break;
			case 4:
				yh(b$1, b$1.stateNode.containerInfo);
				break;
			case 10:
				var d = b$1.type._context, e = b$1.memoizedProps.value;
				G(Wg, d._currentValue);
				d._currentValue = e;
				break;
			case 13:
				d = b$1.memoizedState;
				if (null !== d) {
					if (null !== d.dehydrated) return G(L, L.current & 1), b$1.flags |= 128, null;
					if (0 !== (c & b$1.child.childLanes)) return oj(a, b$1, c);
					G(L, L.current & 1);
					a = Zi(a, b$1, c);
					return null !== a ? a.sibling : null;
				}
				G(L, L.current & 1);
				break;
			case 19:
				d = 0 !== (c & b$1.childLanes);
				if (0 !== (a.flags & 128)) {
					if (d) return xj(a, b$1, c);
					b$1.flags |= 128;
				}
				e = b$1.memoizedState;
				null !== e && (e.rendering = null, e.tail = null, e.lastEffect = null);
				G(L, L.current);
				if (d) break;
				else return null;
			case 22:
			case 23: return b$1.lanes = 0, dj(a, b$1, c);
		}
		return Zi(a, b$1, c);
	}
	var zj = function(a, b$1) {
		for (var c = b$1.child; null !== c;) {
			if (5 === c.tag || 6 === c.tag) a.appendChild(c.stateNode);
			else if (4 !== c.tag && null !== c.child) {
				c.child.return = c;
				c = c.child;
				continue;
			}
			if (c === b$1) break;
			for (; null === c.sibling;) {
				if (null === c.return || c.return === b$1) return;
				c = c.return;
			}
			c.sibling.return = c.return;
			c = c.sibling;
		}
	}, Aj = function() {}, Bj = function(a, b$1, c, d) {
		var e = a.memoizedProps;
		if (e !== d) {
			a = b$1.stateNode;
			xh(uh.current);
			var f$2 = null;
			switch (c) {
				case "input":
					e = Ya(a, e);
					d = Ya(a, d);
					f$2 = [];
					break;
				case "select":
					e = A({}, e, { value: void 0 });
					d = A({}, d, { value: void 0 });
					f$2 = [];
					break;
				case "textarea":
					e = gb(a, e);
					d = gb(a, d);
					f$2 = [];
					break;
				default: "function" !== typeof e.onClick && "function" === typeof d.onClick && (a.onclick = Bf);
			}
			ub(c, d);
			var g$2;
			c = null;
			for (l$3 in e) if (!d.hasOwnProperty(l$3) && e.hasOwnProperty(l$3) && null != e[l$3]) if ("style" === l$3) {
				var h$1 = e[l$3];
				for (g$2 in h$1) h$1.hasOwnProperty(g$2) && (c || (c = {}), c[g$2] = "");
			} else "dangerouslySetInnerHTML" !== l$3 && "children" !== l$3 && "suppressContentEditableWarning" !== l$3 && "suppressHydrationWarning" !== l$3 && "autoFocus" !== l$3 && (ea.hasOwnProperty(l$3) ? f$2 || (f$2 = []) : (f$2 = f$2 || []).push(l$3, null));
			for (l$3 in d) {
				var k$2 = d[l$3];
				h$1 = null != e ? e[l$3] : void 0;
				if (d.hasOwnProperty(l$3) && k$2 !== h$1 && (null != k$2 || null != h$1)) if ("style" === l$3) if (h$1) {
					for (g$2 in h$1) !h$1.hasOwnProperty(g$2) || k$2 && k$2.hasOwnProperty(g$2) || (c || (c = {}), c[g$2] = "");
					for (g$2 in k$2) k$2.hasOwnProperty(g$2) && h$1[g$2] !== k$2[g$2] && (c || (c = {}), c[g$2] = k$2[g$2]);
				} else c || (f$2 || (f$2 = []), f$2.push(l$3, c)), c = k$2;
				else "dangerouslySetInnerHTML" === l$3 ? (k$2 = k$2 ? k$2.__html : void 0, h$1 = h$1 ? h$1.__html : void 0, null != k$2 && h$1 !== k$2 && (f$2 = f$2 || []).push(l$3, k$2)) : "children" === l$3 ? "string" !== typeof k$2 && "number" !== typeof k$2 || (f$2 = f$2 || []).push(l$3, "" + k$2) : "suppressContentEditableWarning" !== l$3 && "suppressHydrationWarning" !== l$3 && (ea.hasOwnProperty(l$3) ? (null != k$2 && "onScroll" === l$3 && D("scroll", a), f$2 || h$1 === k$2 || (f$2 = [])) : (f$2 = f$2 || []).push(l$3, k$2));
			}
			c && (f$2 = f$2 || []).push("style", c);
			var l$3 = f$2;
			if (b$1.updateQueue = l$3) b$1.flags |= 4;
		}
	}, Cj = function(a, b$1, c, d) {
		c !== d && (b$1.flags |= 4);
	};
	function Dj(a, b$1) {
		if (!I$1) switch (a.tailMode) {
			case "hidden":
				b$1 = a.tail;
				for (var c = null; null !== b$1;) null !== b$1.alternate && (c = b$1), b$1 = b$1.sibling;
				null === c ? a.tail = null : c.sibling = null;
				break;
			case "collapsed":
				c = a.tail;
				for (var d = null; null !== c;) null !== c.alternate && (d = c), c = c.sibling;
				null === d ? b$1 || null === a.tail ? a.tail = null : a.tail.sibling = null : d.sibling = null;
		}
	}
	function S(a) {
		var b$1 = null !== a.alternate && a.alternate.child === a.child, c = 0, d = 0;
		if (b$1) for (var e = a.child; null !== e;) c |= e.lanes | e.childLanes, d |= e.subtreeFlags & 14680064, d |= e.flags & 14680064, e.return = a, e = e.sibling;
		else for (e = a.child; null !== e;) c |= e.lanes | e.childLanes, d |= e.subtreeFlags, d |= e.flags, e.return = a, e = e.sibling;
		a.subtreeFlags |= d;
		a.childLanes = c;
		return b$1;
	}
	function Ej(a, b$1, c) {
		var d = b$1.pendingProps;
		wg(b$1);
		switch (b$1.tag) {
			case 2:
			case 16:
			case 15:
			case 0:
			case 11:
			case 7:
			case 8:
			case 12:
			case 9:
			case 14: return S(b$1), null;
			case 1: return Zf(b$1.type) && $f(), S(b$1), null;
			case 3:
				d = b$1.stateNode;
				zh();
				E$1(Wf);
				E$1(H$1);
				Eh();
				d.pendingContext && (d.context = d.pendingContext, d.pendingContext = null);
				if (null === a || null === a.child) Gg(b$1) ? b$1.flags |= 4 : null === a || a.memoizedState.isDehydrated && 0 === (b$1.flags & 256) || (b$1.flags |= 1024, null !== zg && (Fj(zg), zg = null));
				Aj(a, b$1);
				S(b$1);
				return null;
			case 5:
				Bh(b$1);
				var e = xh(wh.current);
				c = b$1.type;
				if (null !== a && null != b$1.stateNode) Bj(a, b$1, c, d, e), a.ref !== b$1.ref && (b$1.flags |= 512, b$1.flags |= 2097152);
				else {
					if (!d) {
						if (null === b$1.stateNode) throw Error(p$1(166));
						S(b$1);
						return null;
					}
					a = xh(uh.current);
					if (Gg(b$1)) {
						d = b$1.stateNode;
						c = b$1.type;
						var f$2 = b$1.memoizedProps;
						d[Of] = b$1;
						d[Pf] = f$2;
						a = 0 !== (b$1.mode & 1);
						switch (c) {
							case "dialog":
								D("cancel", d);
								D("close", d);
								break;
							case "iframe":
							case "object":
							case "embed":
								D("load", d);
								break;
							case "video":
							case "audio":
								for (e = 0; e < lf.length; e++) D(lf[e], d);
								break;
							case "source":
								D("error", d);
								break;
							case "img":
							case "image":
							case "link":
								D("error", d);
								D("load", d);
								break;
							case "details":
								D("toggle", d);
								break;
							case "input":
								Za(d, f$2);
								D("invalid", d);
								break;
							case "select":
								d._wrapperState = { wasMultiple: !!f$2.multiple };
								D("invalid", d);
								break;
							case "textarea": hb(d, f$2), D("invalid", d);
						}
						ub(c, f$2);
						e = null;
						for (var g$2 in f$2) if (f$2.hasOwnProperty(g$2)) {
							var h$1 = f$2[g$2];
							"children" === g$2 ? "string" === typeof h$1 ? d.textContent !== h$1 && (!0 !== f$2.suppressHydrationWarning && Af(d.textContent, h$1, a), e = ["children", h$1]) : "number" === typeof h$1 && d.textContent !== "" + h$1 && (!0 !== f$2.suppressHydrationWarning && Af(d.textContent, h$1, a), e = ["children", "" + h$1]) : ea.hasOwnProperty(g$2) && null != h$1 && "onScroll" === g$2 && D("scroll", d);
						}
						switch (c) {
							case "input":
								Va(d);
								db(d, f$2, !0);
								break;
							case "textarea":
								Va(d);
								jb(d);
								break;
							case "select":
							case "option": break;
							default: "function" === typeof f$2.onClick && (d.onclick = Bf);
						}
						d = e;
						b$1.updateQueue = d;
						null !== d && (b$1.flags |= 4);
					} else {
						g$2 = 9 === e.nodeType ? e : e.ownerDocument;
						"http://www.w3.org/1999/xhtml" === a && (a = kb(c));
						"http://www.w3.org/1999/xhtml" === a ? "script" === c ? (a = g$2.createElement("div"), a.innerHTML = "<script><\/script>", a = a.removeChild(a.firstChild)) : "string" === typeof d.is ? a = g$2.createElement(c, { is: d.is }) : (a = g$2.createElement(c), "select" === c && (g$2 = a, d.multiple ? g$2.multiple = !0 : d.size && (g$2.size = d.size))) : a = g$2.createElementNS(a, c);
						a[Of] = b$1;
						a[Pf] = d;
						zj(a, b$1, !1, !1);
						b$1.stateNode = a;
						a: {
							g$2 = vb(c, d);
							switch (c) {
								case "dialog":
									D("cancel", a);
									D("close", a);
									e = d;
									break;
								case "iframe":
								case "object":
								case "embed":
									D("load", a);
									e = d;
									break;
								case "video":
								case "audio":
									for (e = 0; e < lf.length; e++) D(lf[e], a);
									e = d;
									break;
								case "source":
									D("error", a);
									e = d;
									break;
								case "img":
								case "image":
								case "link":
									D("error", a);
									D("load", a);
									e = d;
									break;
								case "details":
									D("toggle", a);
									e = d;
									break;
								case "input":
									Za(a, d);
									e = Ya(a, d);
									D("invalid", a);
									break;
								case "option":
									e = d;
									break;
								case "select":
									a._wrapperState = { wasMultiple: !!d.multiple };
									e = A({}, d, { value: void 0 });
									D("invalid", a);
									break;
								case "textarea":
									hb(a, d);
									e = gb(a, d);
									D("invalid", a);
									break;
								default: e = d;
							}
							ub(c, e);
							h$1 = e;
							for (f$2 in h$1) if (h$1.hasOwnProperty(f$2)) {
								var k$2 = h$1[f$2];
								"style" === f$2 ? sb(a, k$2) : "dangerouslySetInnerHTML" === f$2 ? (k$2 = k$2 ? k$2.__html : void 0, null != k$2 && nb(a, k$2)) : "children" === f$2 ? "string" === typeof k$2 ? ("textarea" !== c || "" !== k$2) && ob(a, k$2) : "number" === typeof k$2 && ob(a, "" + k$2) : "suppressContentEditableWarning" !== f$2 && "suppressHydrationWarning" !== f$2 && "autoFocus" !== f$2 && (ea.hasOwnProperty(f$2) ? null != k$2 && "onScroll" === f$2 && D("scroll", a) : null != k$2 && ta(a, f$2, k$2, g$2));
							}
							switch (c) {
								case "input":
									Va(a);
									db(a, d, !1);
									break;
								case "textarea":
									Va(a);
									jb(a);
									break;
								case "option":
									null != d.value && a.setAttribute("value", "" + Sa(d.value));
									break;
								case "select":
									a.multiple = !!d.multiple;
									f$2 = d.value;
									null != f$2 ? fb(a, !!d.multiple, f$2, !1) : null != d.defaultValue && fb(a, !!d.multiple, d.defaultValue, !0);
									break;
								default: "function" === typeof e.onClick && (a.onclick = Bf);
							}
							switch (c) {
								case "button":
								case "input":
								case "select":
								case "textarea":
									d = !!d.autoFocus;
									break a;
								case "img":
									d = !0;
									break a;
								default: d = !1;
							}
						}
						d && (b$1.flags |= 4);
					}
					null !== b$1.ref && (b$1.flags |= 512, b$1.flags |= 2097152);
				}
				S(b$1);
				return null;
			case 6:
				if (a && null != b$1.stateNode) Cj(a, b$1, a.memoizedProps, d);
				else {
					if ("string" !== typeof d && null === b$1.stateNode) throw Error(p$1(166));
					c = xh(wh.current);
					xh(uh.current);
					if (Gg(b$1)) {
						d = b$1.stateNode;
						c = b$1.memoizedProps;
						d[Of] = b$1;
						if (f$2 = d.nodeValue !== c) {
							if (a = xg, null !== a) switch (a.tag) {
								case 3:
									Af(d.nodeValue, c, 0 !== (a.mode & 1));
									break;
								case 5: !0 !== a.memoizedProps.suppressHydrationWarning && Af(d.nodeValue, c, 0 !== (a.mode & 1));
							}
						}
						f$2 && (b$1.flags |= 4);
					} else d = (9 === c.nodeType ? c : c.ownerDocument).createTextNode(d), d[Of] = b$1, b$1.stateNode = d;
				}
				S(b$1);
				return null;
			case 13:
				E$1(L);
				d = b$1.memoizedState;
				if (null === a || null !== a.memoizedState && null !== a.memoizedState.dehydrated) {
					if (I$1 && null !== yg && 0 !== (b$1.mode & 1) && 0 === (b$1.flags & 128)) Hg(), Ig(), b$1.flags |= 98560, f$2 = !1;
					else if (f$2 = Gg(b$1), null !== d && null !== d.dehydrated) {
						if (null === a) {
							if (!f$2) throw Error(p$1(318));
							f$2 = b$1.memoizedState;
							f$2 = null !== f$2 ? f$2.dehydrated : null;
							if (!f$2) throw Error(p$1(317));
							f$2[Of] = b$1;
						} else Ig(), 0 === (b$1.flags & 128) && (b$1.memoizedState = null), b$1.flags |= 4;
						S(b$1);
						f$2 = !1;
					} else null !== zg && (Fj(zg), zg = null), f$2 = !0;
					if (!f$2) return b$1.flags & 65536 ? b$1 : null;
				}
				if (0 !== (b$1.flags & 128)) return b$1.lanes = c, b$1;
				d = null !== d;
				d !== (null !== a && null !== a.memoizedState) && d && (b$1.child.flags |= 8192, 0 !== (b$1.mode & 1) && (null === a || 0 !== (L.current & 1) ? 0 === T && (T = 3) : tj()));
				null !== b$1.updateQueue && (b$1.flags |= 4);
				S(b$1);
				return null;
			case 4: return zh(), Aj(a, b$1), null === a && sf(b$1.stateNode.containerInfo), S(b$1), null;
			case 10: return ah(b$1.type._context), S(b$1), null;
			case 17: return Zf(b$1.type) && $f(), S(b$1), null;
			case 19:
				E$1(L);
				f$2 = b$1.memoizedState;
				if (null === f$2) return S(b$1), null;
				d = 0 !== (b$1.flags & 128);
				g$2 = f$2.rendering;
				if (null === g$2) if (d) Dj(f$2, !1);
				else {
					if (0 !== T || null !== a && 0 !== (a.flags & 128)) for (a = b$1.child; null !== a;) {
						g$2 = Ch(a);
						if (null !== g$2) {
							b$1.flags |= 128;
							Dj(f$2, !1);
							d = g$2.updateQueue;
							null !== d && (b$1.updateQueue = d, b$1.flags |= 4);
							b$1.subtreeFlags = 0;
							d = c;
							for (c = b$1.child; null !== c;) f$2 = c, a = d, f$2.flags &= 14680066, g$2 = f$2.alternate, null === g$2 ? (f$2.childLanes = 0, f$2.lanes = a, f$2.child = null, f$2.subtreeFlags = 0, f$2.memoizedProps = null, f$2.memoizedState = null, f$2.updateQueue = null, f$2.dependencies = null, f$2.stateNode = null) : (f$2.childLanes = g$2.childLanes, f$2.lanes = g$2.lanes, f$2.child = g$2.child, f$2.subtreeFlags = 0, f$2.deletions = null, f$2.memoizedProps = g$2.memoizedProps, f$2.memoizedState = g$2.memoizedState, f$2.updateQueue = g$2.updateQueue, f$2.type = g$2.type, a = g$2.dependencies, f$2.dependencies = null === a ? null : {
								lanes: a.lanes,
								firstContext: a.firstContext
							}), c = c.sibling;
							G(L, L.current & 1 | 2);
							return b$1.child;
						}
						a = a.sibling;
					}
					null !== f$2.tail && B() > Gj && (b$1.flags |= 128, d = !0, Dj(f$2, !1), b$1.lanes = 4194304);
				}
				else {
					if (!d) if (a = Ch(g$2), null !== a) {
						if (b$1.flags |= 128, d = !0, c = a.updateQueue, null !== c && (b$1.updateQueue = c, b$1.flags |= 4), Dj(f$2, !0), null === f$2.tail && "hidden" === f$2.tailMode && !g$2.alternate && !I$1) return S(b$1), null;
					} else 2 * B() - f$2.renderingStartTime > Gj && 1073741824 !== c && (b$1.flags |= 128, d = !0, Dj(f$2, !1), b$1.lanes = 4194304);
					f$2.isBackwards ? (g$2.sibling = b$1.child, b$1.child = g$2) : (c = f$2.last, null !== c ? c.sibling = g$2 : b$1.child = g$2, f$2.last = g$2);
				}
				if (null !== f$2.tail) return b$1 = f$2.tail, f$2.rendering = b$1, f$2.tail = b$1.sibling, f$2.renderingStartTime = B(), b$1.sibling = null, c = L.current, G(L, d ? c & 1 | 2 : c & 1), b$1;
				S(b$1);
				return null;
			case 22:
			case 23: return Hj(), d = null !== b$1.memoizedState, null !== a && null !== a.memoizedState !== d && (b$1.flags |= 8192), d && 0 !== (b$1.mode & 1) ? 0 !== (fj & 1073741824) && (S(b$1), b$1.subtreeFlags & 6 && (b$1.flags |= 8192)) : S(b$1), null;
			case 24: return null;
			case 25: return null;
		}
		throw Error(p$1(156, b$1.tag));
	}
	function Ij(a, b$1) {
		wg(b$1);
		switch (b$1.tag) {
			case 1: return Zf(b$1.type) && $f(), a = b$1.flags, a & 65536 ? (b$1.flags = a & -65537 | 128, b$1) : null;
			case 3: return zh(), E$1(Wf), E$1(H$1), Eh(), a = b$1.flags, 0 !== (a & 65536) && 0 === (a & 128) ? (b$1.flags = a & -65537 | 128, b$1) : null;
			case 5: return Bh(b$1), null;
			case 13:
				E$1(L);
				a = b$1.memoizedState;
				if (null !== a && null !== a.dehydrated) {
					if (null === b$1.alternate) throw Error(p$1(340));
					Ig();
				}
				a = b$1.flags;
				return a & 65536 ? (b$1.flags = a & -65537 | 128, b$1) : null;
			case 19: return E$1(L), null;
			case 4: return zh(), null;
			case 10: return ah(b$1.type._context), null;
			case 22:
			case 23: return Hj(), null;
			case 24: return null;
			default: return null;
		}
	}
	var Jj = !1, U$1 = !1, Kj = "function" === typeof WeakSet ? WeakSet : Set, V$1 = null;
	function Lj(a, b$1) {
		var c = a.ref;
		if (null !== c) if ("function" === typeof c) try {
			c(null);
		} catch (d) {
			W$1(a, b$1, d);
		}
		else c.current = null;
	}
	function Mj(a, b$1, c) {
		try {
			c();
		} catch (d) {
			W$1(a, b$1, d);
		}
	}
	var Nj = !1;
	function Oj(a, b$1) {
		Cf = dd;
		a = Me();
		if (Ne(a)) {
			if ("selectionStart" in a) var c = {
				start: a.selectionStart,
				end: a.selectionEnd
			};
			else a: {
				c = (c = a.ownerDocument) && c.defaultView || window;
				var d = c.getSelection && c.getSelection();
				if (d && 0 !== d.rangeCount) {
					c = d.anchorNode;
					var e = d.anchorOffset, f$2 = d.focusNode;
					d = d.focusOffset;
					try {
						c.nodeType, f$2.nodeType;
					} catch (F$2) {
						c = null;
						break a;
					}
					var g$2 = 0, h$1 = -1, k$2 = -1, l$3 = 0, m$2 = 0, q$3 = a, r$3 = null;
					b: for (;;) {
						for (var y$2;;) {
							q$3 !== c || 0 !== e && 3 !== q$3.nodeType || (h$1 = g$2 + e);
							q$3 !== f$2 || 0 !== d && 3 !== q$3.nodeType || (k$2 = g$2 + d);
							3 === q$3.nodeType && (g$2 += q$3.nodeValue.length);
							if (null === (y$2 = q$3.firstChild)) break;
							r$3 = q$3;
							q$3 = y$2;
						}
						for (;;) {
							if (q$3 === a) break b;
							r$3 === c && ++l$3 === e && (h$1 = g$2);
							r$3 === f$2 && ++m$2 === d && (k$2 = g$2);
							if (null !== (y$2 = q$3.nextSibling)) break;
							q$3 = r$3;
							r$3 = q$3.parentNode;
						}
						q$3 = y$2;
					}
					c = -1 === h$1 || -1 === k$2 ? null : {
						start: h$1,
						end: k$2
					};
				} else c = null;
			}
			c = c || {
				start: 0,
				end: 0
			};
		} else c = null;
		Df = {
			focusedElem: a,
			selectionRange: c
		};
		dd = !1;
		for (V$1 = b$1; null !== V$1;) if (b$1 = V$1, a = b$1.child, 0 !== (b$1.subtreeFlags & 1028) && null !== a) a.return = b$1, V$1 = a;
		else for (; null !== V$1;) {
			b$1 = V$1;
			try {
				var n$2 = b$1.alternate;
				if (0 !== (b$1.flags & 1024)) switch (b$1.tag) {
					case 0:
					case 11:
					case 15: break;
					case 1:
						if (null !== n$2) {
							var t$2 = n$2.memoizedProps, J$3 = n$2.memoizedState, x$2 = b$1.stateNode;
							x$2.__reactInternalSnapshotBeforeUpdate = x$2.getSnapshotBeforeUpdate(b$1.elementType === b$1.type ? t$2 : Ci(b$1.type, t$2), J$3);
						}
						break;
					case 3:
						var u$3 = b$1.stateNode.containerInfo;
						1 === u$3.nodeType ? u$3.textContent = "" : 9 === u$3.nodeType && u$3.documentElement && u$3.removeChild(u$3.documentElement);
						break;
					case 5:
					case 6:
					case 4:
					case 17: break;
					default: throw Error(p$1(163));
				}
			} catch (F$2) {
				W$1(b$1, b$1.return, F$2);
			}
			a = b$1.sibling;
			if (null !== a) {
				a.return = b$1.return;
				V$1 = a;
				break;
			}
			V$1 = b$1.return;
		}
		n$2 = Nj;
		Nj = !1;
		return n$2;
	}
	function Pj(a, b$1, c) {
		var d = b$1.updateQueue;
		d = null !== d ? d.lastEffect : null;
		if (null !== d) {
			var e = d = d.next;
			do {
				if ((e.tag & a) === a) {
					var f$2 = e.destroy;
					e.destroy = void 0;
					void 0 !== f$2 && Mj(b$1, c, f$2);
				}
				e = e.next;
			} while (e !== d);
		}
	}
	function Qj(a, b$1) {
		b$1 = b$1.updateQueue;
		b$1 = null !== b$1 ? b$1.lastEffect : null;
		if (null !== b$1) {
			var c = b$1 = b$1.next;
			do {
				if ((c.tag & a) === a) {
					var d = c.create;
					c.destroy = d();
				}
				c = c.next;
			} while (c !== b$1);
		}
	}
	function Rj(a) {
		var b$1 = a.ref;
		if (null !== b$1) {
			var c = a.stateNode;
			switch (a.tag) {
				case 5:
					a = c;
					break;
				default: a = c;
			}
			"function" === typeof b$1 ? b$1(a) : b$1.current = a;
		}
	}
	function Sj(a) {
		var b$1 = a.alternate;
		null !== b$1 && (a.alternate = null, Sj(b$1));
		a.child = null;
		a.deletions = null;
		a.sibling = null;
		5 === a.tag && (b$1 = a.stateNode, null !== b$1 && (delete b$1[Of], delete b$1[Pf], delete b$1[of], delete b$1[Qf], delete b$1[Rf]));
		a.stateNode = null;
		a.return = null;
		a.dependencies = null;
		a.memoizedProps = null;
		a.memoizedState = null;
		a.pendingProps = null;
		a.stateNode = null;
		a.updateQueue = null;
	}
	function Tj(a) {
		return 5 === a.tag || 3 === a.tag || 4 === a.tag;
	}
	function Uj(a) {
		a: for (;;) {
			for (; null === a.sibling;) {
				if (null === a.return || Tj(a.return)) return null;
				a = a.return;
			}
			a.sibling.return = a.return;
			for (a = a.sibling; 5 !== a.tag && 6 !== a.tag && 18 !== a.tag;) {
				if (a.flags & 2) continue a;
				if (null === a.child || 4 === a.tag) continue a;
				else a.child.return = a, a = a.child;
			}
			if (!(a.flags & 2)) return a.stateNode;
		}
	}
	function Vj(a, b$1, c) {
		var d = a.tag;
		if (5 === d || 6 === d) a = a.stateNode, b$1 ? 8 === c.nodeType ? c.parentNode.insertBefore(a, b$1) : c.insertBefore(a, b$1) : (8 === c.nodeType ? (b$1 = c.parentNode, b$1.insertBefore(a, c)) : (b$1 = c, b$1.appendChild(a)), c = c._reactRootContainer, null !== c && void 0 !== c || null !== b$1.onclick || (b$1.onclick = Bf));
		else if (4 !== d && (a = a.child, null !== a)) for (Vj(a, b$1, c), a = a.sibling; null !== a;) Vj(a, b$1, c), a = a.sibling;
	}
	function Wj(a, b$1, c) {
		var d = a.tag;
		if (5 === d || 6 === d) a = a.stateNode, b$1 ? c.insertBefore(a, b$1) : c.appendChild(a);
		else if (4 !== d && (a = a.child, null !== a)) for (Wj(a, b$1, c), a = a.sibling; null !== a;) Wj(a, b$1, c), a = a.sibling;
	}
	var X = null, Xj = !1;
	function Yj(a, b$1, c) {
		for (c = c.child; null !== c;) Zj(a, b$1, c), c = c.sibling;
	}
	function Zj(a, b$1, c) {
		if (lc && "function" === typeof lc.onCommitFiberUnmount) try {
			lc.onCommitFiberUnmount(kc, c);
		} catch (h$1) {}
		switch (c.tag) {
			case 5: U$1 || Lj(c, b$1);
			case 6:
				var d = X, e = Xj;
				X = null;
				Yj(a, b$1, c);
				X = d;
				Xj = e;
				null !== X && (Xj ? (a = X, c = c.stateNode, 8 === a.nodeType ? a.parentNode.removeChild(c) : a.removeChild(c)) : X.removeChild(c.stateNode));
				break;
			case 18:
				null !== X && (Xj ? (a = X, c = c.stateNode, 8 === a.nodeType ? Kf(a.parentNode, c) : 1 === a.nodeType && Kf(a, c), bd(a)) : Kf(X, c.stateNode));
				break;
			case 4:
				d = X;
				e = Xj;
				X = c.stateNode.containerInfo;
				Xj = !0;
				Yj(a, b$1, c);
				X = d;
				Xj = e;
				break;
			case 0:
			case 11:
			case 14:
			case 15:
				if (!U$1 && (d = c.updateQueue, null !== d && (d = d.lastEffect, null !== d))) {
					e = d = d.next;
					do {
						var f$2 = e, g$2 = f$2.destroy;
						f$2 = f$2.tag;
						void 0 !== g$2 && (0 !== (f$2 & 2) ? Mj(c, b$1, g$2) : 0 !== (f$2 & 4) && Mj(c, b$1, g$2));
						e = e.next;
					} while (e !== d);
				}
				Yj(a, b$1, c);
				break;
			case 1:
				if (!U$1 && (Lj(c, b$1), d = c.stateNode, "function" === typeof d.componentWillUnmount)) try {
					d.props = c.memoizedProps, d.state = c.memoizedState, d.componentWillUnmount();
				} catch (h$1) {
					W$1(c, b$1, h$1);
				}
				Yj(a, b$1, c);
				break;
			case 21:
				Yj(a, b$1, c);
				break;
			case 22:
				c.mode & 1 ? (U$1 = (d = U$1) || null !== c.memoizedState, Yj(a, b$1, c), U$1 = d) : Yj(a, b$1, c);
				break;
			default: Yj(a, b$1, c);
		}
	}
	function ak(a) {
		var b$1 = a.updateQueue;
		if (null !== b$1) {
			a.updateQueue = null;
			var c = a.stateNode;
			null === c && (c = a.stateNode = new Kj());
			b$1.forEach(function(b$2) {
				var d = bk.bind(null, a, b$2);
				c.has(b$2) || (c.add(b$2), b$2.then(d, d));
			});
		}
	}
	function ck(a, b$1) {
		var c = b$1.deletions;
		if (null !== c) for (var d = 0; d < c.length; d++) {
			var e = c[d];
			try {
				var f$2 = a, g$2 = b$1, h$1 = g$2;
				a: for (; null !== h$1;) {
					switch (h$1.tag) {
						case 5:
							X = h$1.stateNode;
							Xj = !1;
							break a;
						case 3:
							X = h$1.stateNode.containerInfo;
							Xj = !0;
							break a;
						case 4:
							X = h$1.stateNode.containerInfo;
							Xj = !0;
							break a;
					}
					h$1 = h$1.return;
				}
				if (null === X) throw Error(p$1(160));
				Zj(f$2, g$2, e);
				X = null;
				Xj = !1;
				var k$2 = e.alternate;
				null !== k$2 && (k$2.return = null);
				e.return = null;
			} catch (l$3) {
				W$1(e, b$1, l$3);
			}
		}
		if (b$1.subtreeFlags & 12854) for (b$1 = b$1.child; null !== b$1;) dk(b$1, a), b$1 = b$1.sibling;
	}
	function dk(a, b$1) {
		var c = a.alternate, d = a.flags;
		switch (a.tag) {
			case 0:
			case 11:
			case 14:
			case 15:
				ck(b$1, a);
				ek(a);
				if (d & 4) {
					try {
						Pj(3, a, a.return), Qj(3, a);
					} catch (t$2) {
						W$1(a, a.return, t$2);
					}
					try {
						Pj(5, a, a.return);
					} catch (t$2) {
						W$1(a, a.return, t$2);
					}
				}
				break;
			case 1:
				ck(b$1, a);
				ek(a);
				d & 512 && null !== c && Lj(c, c.return);
				break;
			case 5:
				ck(b$1, a);
				ek(a);
				d & 512 && null !== c && Lj(c, c.return);
				if (a.flags & 32) {
					var e = a.stateNode;
					try {
						ob(e, "");
					} catch (t$2) {
						W$1(a, a.return, t$2);
					}
				}
				if (d & 4 && (e = a.stateNode, null != e)) {
					var f$2 = a.memoizedProps, g$2 = null !== c ? c.memoizedProps : f$2, h$1 = a.type, k$2 = a.updateQueue;
					a.updateQueue = null;
					if (null !== k$2) try {
						"input" === h$1 && "radio" === f$2.type && null != f$2.name && ab(e, f$2);
						vb(h$1, g$2);
						var l$3 = vb(h$1, f$2);
						for (g$2 = 0; g$2 < k$2.length; g$2 += 2) {
							var m$2 = k$2[g$2], q$3 = k$2[g$2 + 1];
							"style" === m$2 ? sb(e, q$3) : "dangerouslySetInnerHTML" === m$2 ? nb(e, q$3) : "children" === m$2 ? ob(e, q$3) : ta(e, m$2, q$3, l$3);
						}
						switch (h$1) {
							case "input":
								bb(e, f$2);
								break;
							case "textarea":
								ib(e, f$2);
								break;
							case "select":
								var r$3 = e._wrapperState.wasMultiple;
								e._wrapperState.wasMultiple = !!f$2.multiple;
								var y$2 = f$2.value;
								null != y$2 ? fb(e, !!f$2.multiple, y$2, !1) : r$3 !== !!f$2.multiple && (null != f$2.defaultValue ? fb(e, !!f$2.multiple, f$2.defaultValue, !0) : fb(e, !!f$2.multiple, f$2.multiple ? [] : "", !1));
						}
						e[Pf] = f$2;
					} catch (t$2) {
						W$1(a, a.return, t$2);
					}
				}
				break;
			case 6:
				ck(b$1, a);
				ek(a);
				if (d & 4) {
					if (null === a.stateNode) throw Error(p$1(162));
					e = a.stateNode;
					f$2 = a.memoizedProps;
					try {
						e.nodeValue = f$2;
					} catch (t$2) {
						W$1(a, a.return, t$2);
					}
				}
				break;
			case 3:
				ck(b$1, a);
				ek(a);
				if (d & 4 && null !== c && c.memoizedState.isDehydrated) try {
					bd(b$1.containerInfo);
				} catch (t$2) {
					W$1(a, a.return, t$2);
				}
				break;
			case 4:
				ck(b$1, a);
				ek(a);
				break;
			case 13:
				ck(b$1, a);
				ek(a);
				e = a.child;
				e.flags & 8192 && (f$2 = null !== e.memoizedState, e.stateNode.isHidden = f$2, !f$2 || null !== e.alternate && null !== e.alternate.memoizedState || (fk = B()));
				d & 4 && ak(a);
				break;
			case 22:
				m$2 = null !== c && null !== c.memoizedState;
				a.mode & 1 ? (U$1 = (l$3 = U$1) || m$2, ck(b$1, a), U$1 = l$3) : ck(b$1, a);
				ek(a);
				if (d & 8192) {
					l$3 = null !== a.memoizedState;
					if ((a.stateNode.isHidden = l$3) && !m$2 && 0 !== (a.mode & 1)) for (V$1 = a, m$2 = a.child; null !== m$2;) {
						for (q$3 = V$1 = m$2; null !== V$1;) {
							r$3 = V$1;
							y$2 = r$3.child;
							switch (r$3.tag) {
								case 0:
								case 11:
								case 14:
								case 15:
									Pj(4, r$3, r$3.return);
									break;
								case 1:
									Lj(r$3, r$3.return);
									var n$2 = r$3.stateNode;
									if ("function" === typeof n$2.componentWillUnmount) {
										d = r$3;
										c = r$3.return;
										try {
											b$1 = d, n$2.props = b$1.memoizedProps, n$2.state = b$1.memoizedState, n$2.componentWillUnmount();
										} catch (t$2) {
											W$1(d, c, t$2);
										}
									}
									break;
								case 5:
									Lj(r$3, r$3.return);
									break;
								case 22: if (null !== r$3.memoizedState) {
									gk(q$3);
									continue;
								}
							}
							null !== y$2 ? (y$2.return = r$3, V$1 = y$2) : gk(q$3);
						}
						m$2 = m$2.sibling;
					}
					a: for (m$2 = null, q$3 = a;;) {
						if (5 === q$3.tag) {
							if (null === m$2) {
								m$2 = q$3;
								try {
									e = q$3.stateNode, l$3 ? (f$2 = e.style, "function" === typeof f$2.setProperty ? f$2.setProperty("display", "none", "important") : f$2.display = "none") : (h$1 = q$3.stateNode, k$2 = q$3.memoizedProps.style, g$2 = void 0 !== k$2 && null !== k$2 && k$2.hasOwnProperty("display") ? k$2.display : null, h$1.style.display = rb("display", g$2));
								} catch (t$2) {
									W$1(a, a.return, t$2);
								}
							}
						} else if (6 === q$3.tag) {
							if (null === m$2) try {
								q$3.stateNode.nodeValue = l$3 ? "" : q$3.memoizedProps;
							} catch (t$2) {
								W$1(a, a.return, t$2);
							}
						} else if ((22 !== q$3.tag && 23 !== q$3.tag || null === q$3.memoizedState || q$3 === a) && null !== q$3.child) {
							q$3.child.return = q$3;
							q$3 = q$3.child;
							continue;
						}
						if (q$3 === a) break a;
						for (; null === q$3.sibling;) {
							if (null === q$3.return || q$3.return === a) break a;
							m$2 === q$3 && (m$2 = null);
							q$3 = q$3.return;
						}
						m$2 === q$3 && (m$2 = null);
						q$3.sibling.return = q$3.return;
						q$3 = q$3.sibling;
					}
				}
				break;
			case 19:
				ck(b$1, a);
				ek(a);
				d & 4 && ak(a);
				break;
			case 21: break;
			default: ck(b$1, a), ek(a);
		}
	}
	function ek(a) {
		var b$1 = a.flags;
		if (b$1 & 2) {
			try {
				a: {
					for (var c = a.return; null !== c;) {
						if (Tj(c)) {
							var d = c;
							break a;
						}
						c = c.return;
					}
					throw Error(p$1(160));
				}
				switch (d.tag) {
					case 5:
						var e = d.stateNode;
						d.flags & 32 && (ob(e, ""), d.flags &= -33);
						Wj(a, Uj(a), e);
						break;
					case 3:
					case 4:
						var g$2 = d.stateNode.containerInfo;
						Vj(a, Uj(a), g$2);
						break;
					default: throw Error(p$1(161));
				}
			} catch (k$2) {
				W$1(a, a.return, k$2);
			}
			a.flags &= -3;
		}
		b$1 & 4096 && (a.flags &= -4097);
	}
	function hk(a, b$1, c) {
		V$1 = a;
		ik(a, b$1, c);
	}
	function ik(a, b$1, c) {
		for (var d = 0 !== (a.mode & 1); null !== V$1;) {
			var e = V$1, f$2 = e.child;
			if (22 === e.tag && d) {
				var g$2 = null !== e.memoizedState || Jj;
				if (!g$2) {
					var h$1 = e.alternate, k$2 = null !== h$1 && null !== h$1.memoizedState || U$1;
					h$1 = Jj;
					var l$3 = U$1;
					Jj = g$2;
					if ((U$1 = k$2) && !l$3) for (V$1 = e; null !== V$1;) g$2 = V$1, k$2 = g$2.child, 22 === g$2.tag && null !== g$2.memoizedState ? jk(e) : null !== k$2 ? (k$2.return = g$2, V$1 = k$2) : jk(e);
					for (; null !== f$2;) V$1 = f$2, ik(f$2, b$1, c), f$2 = f$2.sibling;
					V$1 = e;
					Jj = h$1;
					U$1 = l$3;
				}
				kk(a, b$1, c);
			} else 0 !== (e.subtreeFlags & 8772) && null !== f$2 ? (f$2.return = e, V$1 = f$2) : kk(a, b$1, c);
		}
	}
	function kk(a) {
		for (; null !== V$1;) {
			var b$1 = V$1;
			if (0 !== (b$1.flags & 8772)) {
				var c = b$1.alternate;
				try {
					if (0 !== (b$1.flags & 8772)) switch (b$1.tag) {
						case 0:
						case 11:
						case 15:
							U$1 || Qj(5, b$1);
							break;
						case 1:
							var d = b$1.stateNode;
							if (b$1.flags & 4 && !U$1) if (null === c) d.componentDidMount();
							else {
								var e = b$1.elementType === b$1.type ? c.memoizedProps : Ci(b$1.type, c.memoizedProps);
								d.componentDidUpdate(e, c.memoizedState, d.__reactInternalSnapshotBeforeUpdate);
							}
							var f$2 = b$1.updateQueue;
							null !== f$2 && sh(b$1, f$2, d);
							break;
						case 3:
							var g$2 = b$1.updateQueue;
							if (null !== g$2) {
								c = null;
								if (null !== b$1.child) switch (b$1.child.tag) {
									case 5:
										c = b$1.child.stateNode;
										break;
									case 1: c = b$1.child.stateNode;
								}
								sh(b$1, g$2, c);
							}
							break;
						case 5:
							var h$1 = b$1.stateNode;
							if (null === c && b$1.flags & 4) {
								c = h$1;
								var k$2 = b$1.memoizedProps;
								switch (b$1.type) {
									case "button":
									case "input":
									case "select":
									case "textarea":
										k$2.autoFocus && c.focus();
										break;
									case "img": k$2.src && (c.src = k$2.src);
								}
							}
							break;
						case 6: break;
						case 4: break;
						case 12: break;
						case 13:
							if (null === b$1.memoizedState) {
								var l$3 = b$1.alternate;
								if (null !== l$3) {
									var m$2 = l$3.memoizedState;
									if (null !== m$2) {
										var q$3 = m$2.dehydrated;
										null !== q$3 && bd(q$3);
									}
								}
							}
							break;
						case 19:
						case 17:
						case 21:
						case 22:
						case 23:
						case 25: break;
						default: throw Error(p$1(163));
					}
					U$1 || b$1.flags & 512 && Rj(b$1);
				} catch (r$3) {
					W$1(b$1, b$1.return, r$3);
				}
			}
			if (b$1 === a) {
				V$1 = null;
				break;
			}
			c = b$1.sibling;
			if (null !== c) {
				c.return = b$1.return;
				V$1 = c;
				break;
			}
			V$1 = b$1.return;
		}
	}
	function gk(a) {
		for (; null !== V$1;) {
			var b$1 = V$1;
			if (b$1 === a) {
				V$1 = null;
				break;
			}
			var c = b$1.sibling;
			if (null !== c) {
				c.return = b$1.return;
				V$1 = c;
				break;
			}
			V$1 = b$1.return;
		}
	}
	function jk(a) {
		for (; null !== V$1;) {
			var b$1 = V$1;
			try {
				switch (b$1.tag) {
					case 0:
					case 11:
					case 15:
						var c = b$1.return;
						try {
							Qj(4, b$1);
						} catch (k$2) {
							W$1(b$1, c, k$2);
						}
						break;
					case 1:
						var d = b$1.stateNode;
						if ("function" === typeof d.componentDidMount) {
							var e = b$1.return;
							try {
								d.componentDidMount();
							} catch (k$2) {
								W$1(b$1, e, k$2);
							}
						}
						var f$2 = b$1.return;
						try {
							Rj(b$1);
						} catch (k$2) {
							W$1(b$1, f$2, k$2);
						}
						break;
					case 5:
						var g$2 = b$1.return;
						try {
							Rj(b$1);
						} catch (k$2) {
							W$1(b$1, g$2, k$2);
						}
				}
			} catch (k$2) {
				W$1(b$1, b$1.return, k$2);
			}
			if (b$1 === a) {
				V$1 = null;
				break;
			}
			var h$1 = b$1.sibling;
			if (null !== h$1) {
				h$1.return = b$1.return;
				V$1 = h$1;
				break;
			}
			V$1 = b$1.return;
		}
	}
	var lk = Math.ceil, mk = ua.ReactCurrentDispatcher, nk = ua.ReactCurrentOwner, ok = ua.ReactCurrentBatchConfig, K = 0, Q = null, Y = null, Z = 0, fj = 0, ej = Uf(0), T = 0, pk = null, rh = 0, qk = 0, rk = 0, sk = null, tk = null, fk = 0, Gj = Infinity, uk = null, Oi = !1, Pi = null, Ri = null, vk = !1, wk = null, xk = 0, yk = 0, zk = null, Ak = -1, Bk = 0;
	function R() {
		return 0 !== (K & 6) ? B() : -1 !== Ak ? Ak : Ak = B();
	}
	function yi(a) {
		if (0 === (a.mode & 1)) return 1;
		if (0 !== (K & 2) && 0 !== Z) return Z & -Z;
		if (null !== Kg.transition) return 0 === Bk && (Bk = yc()), Bk;
		a = C;
		if (0 !== a) return a;
		a = window.event;
		a = void 0 === a ? 16 : jd(a.type);
		return a;
	}
	function gi(a, b$1, c, d) {
		if (50 < yk) throw yk = 0, zk = null, Error(p$1(185));
		Ac(a, c, d);
		if (0 === (K & 2) || a !== Q) a === Q && (0 === (K & 2) && (qk |= c), 4 === T && Ck(a, Z)), Dk(a, d), 1 === c && 0 === K && 0 === (b$1.mode & 1) && (Gj = B() + 500, fg && jg());
	}
	function Dk(a, b$1) {
		var c = a.callbackNode;
		wc(a, b$1);
		var d = uc(a, a === Q ? Z : 0);
		if (0 === d) null !== c && bc(c), a.callbackNode = null, a.callbackPriority = 0;
		else if (b$1 = d & -d, a.callbackPriority !== b$1) {
			null != c && bc(c);
			if (1 === b$1) 0 === a.tag ? ig(Ek.bind(null, a)) : hg(Ek.bind(null, a)), Jf(function() {
				0 === (K & 6) && jg();
			}), c = null;
			else {
				switch (Dc(d)) {
					case 1:
						c = fc;
						break;
					case 4:
						c = gc;
						break;
					case 16:
						c = hc;
						break;
					case 536870912:
						c = jc;
						break;
					default: c = hc;
				}
				c = Fk(c, Gk.bind(null, a));
			}
			a.callbackPriority = b$1;
			a.callbackNode = c;
		}
	}
	function Gk(a, b$1) {
		Ak = -1;
		Bk = 0;
		if (0 !== (K & 6)) throw Error(p$1(327));
		var c = a.callbackNode;
		if (Hk() && a.callbackNode !== c) return null;
		var d = uc(a, a === Q ? Z : 0);
		if (0 === d) return null;
		if (0 !== (d & 30) || 0 !== (d & a.expiredLanes) || b$1) b$1 = Ik(a, d);
		else {
			b$1 = d;
			var e = K;
			K |= 2;
			var f$2 = Jk();
			if (Q !== a || Z !== b$1) uk = null, Gj = B() + 500, Kk(a, b$1);
			do
				try {
					Lk();
					break;
				} catch (h$1) {
					Mk(a, h$1);
				}
			while (1);
			$g();
			mk.current = f$2;
			K = e;
			null !== Y ? b$1 = 0 : (Q = null, Z = 0, b$1 = T);
		}
		if (0 !== b$1) {
			2 === b$1 && (e = xc(a), 0 !== e && (d = e, b$1 = Nk(a, e)));
			if (1 === b$1) throw c = pk, Kk(a, 0), Ck(a, d), Dk(a, B()), c;
			if (6 === b$1) Ck(a, d);
			else {
				e = a.current.alternate;
				if (0 === (d & 30) && !Ok(e) && (b$1 = Ik(a, d), 2 === b$1 && (f$2 = xc(a), 0 !== f$2 && (d = f$2, b$1 = Nk(a, f$2))), 1 === b$1)) throw c = pk, Kk(a, 0), Ck(a, d), Dk(a, B()), c;
				a.finishedWork = e;
				a.finishedLanes = d;
				switch (b$1) {
					case 0:
					case 1: throw Error(p$1(345));
					case 2:
						Pk(a, tk, uk);
						break;
					case 3:
						Ck(a, d);
						if ((d & 130023424) === d && (b$1 = fk + 500 - B(), 10 < b$1)) {
							if (0 !== uc(a, 0)) break;
							e = a.suspendedLanes;
							if ((e & d) !== d) {
								R();
								a.pingedLanes |= a.suspendedLanes & e;
								break;
							}
							a.timeoutHandle = Ff(Pk.bind(null, a, tk, uk), b$1);
							break;
						}
						Pk(a, tk, uk);
						break;
					case 4:
						Ck(a, d);
						if ((d & 4194240) === d) break;
						b$1 = a.eventTimes;
						for (e = -1; 0 < d;) {
							var g$2 = 31 - oc(d);
							f$2 = 1 << g$2;
							g$2 = b$1[g$2];
							g$2 > e && (e = g$2);
							d &= ~f$2;
						}
						d = e;
						d = B() - d;
						d = (120 > d ? 120 : 480 > d ? 480 : 1080 > d ? 1080 : 1920 > d ? 1920 : 3e3 > d ? 3e3 : 4320 > d ? 4320 : 1960 * lk(d / 1960)) - d;
						if (10 < d) {
							a.timeoutHandle = Ff(Pk.bind(null, a, tk, uk), d);
							break;
						}
						Pk(a, tk, uk);
						break;
					case 5:
						Pk(a, tk, uk);
						break;
					default: throw Error(p$1(329));
				}
			}
		}
		Dk(a, B());
		return a.callbackNode === c ? Gk.bind(null, a) : null;
	}
	function Nk(a, b$1) {
		var c = sk;
		a.current.memoizedState.isDehydrated && (Kk(a, b$1).flags |= 256);
		a = Ik(a, b$1);
		2 !== a && (b$1 = tk, tk = c, null !== b$1 && Fj(b$1));
		return a;
	}
	function Fj(a) {
		null === tk ? tk = a : tk.push.apply(tk, a);
	}
	function Ok(a) {
		for (var b$1 = a;;) {
			if (b$1.flags & 16384) {
				var c = b$1.updateQueue;
				if (null !== c && (c = c.stores, null !== c)) for (var d = 0; d < c.length; d++) {
					var e = c[d], f$2 = e.getSnapshot;
					e = e.value;
					try {
						if (!He(f$2(), e)) return !1;
					} catch (g$2) {
						return !1;
					}
				}
			}
			c = b$1.child;
			if (b$1.subtreeFlags & 16384 && null !== c) c.return = b$1, b$1 = c;
			else {
				if (b$1 === a) break;
				for (; null === b$1.sibling;) {
					if (null === b$1.return || b$1.return === a) return !0;
					b$1 = b$1.return;
				}
				b$1.sibling.return = b$1.return;
				b$1 = b$1.sibling;
			}
		}
		return !0;
	}
	function Ck(a, b$1) {
		b$1 &= ~rk;
		b$1 &= ~qk;
		a.suspendedLanes |= b$1;
		a.pingedLanes &= ~b$1;
		for (a = a.expirationTimes; 0 < b$1;) {
			var c = 31 - oc(b$1), d = 1 << c;
			a[c] = -1;
			b$1 &= ~d;
		}
	}
	function Ek(a) {
		if (0 !== (K & 6)) throw Error(p$1(327));
		Hk();
		var b$1 = uc(a, 0);
		if (0 === (b$1 & 1)) return Dk(a, B()), null;
		var c = Ik(a, b$1);
		if (0 !== a.tag && 2 === c) {
			var d = xc(a);
			0 !== d && (b$1 = d, c = Nk(a, d));
		}
		if (1 === c) throw c = pk, Kk(a, 0), Ck(a, b$1), Dk(a, B()), c;
		if (6 === c) throw Error(p$1(345));
		a.finishedWork = a.current.alternate;
		a.finishedLanes = b$1;
		Pk(a, tk, uk);
		Dk(a, B());
		return null;
	}
	function Qk(a, b$1) {
		var c = K;
		K |= 1;
		try {
			return a(b$1);
		} finally {
			K = c, 0 === K && (Gj = B() + 500, fg && jg());
		}
	}
	function Rk(a) {
		null !== wk && 0 === wk.tag && 0 === (K & 6) && Hk();
		var b$1 = K;
		K |= 1;
		var c = ok.transition, d = C;
		try {
			if (ok.transition = null, C = 1, a) return a();
		} finally {
			C = d, ok.transition = c, K = b$1, 0 === (K & 6) && jg();
		}
	}
	function Hj() {
		fj = ej.current;
		E$1(ej);
	}
	function Kk(a, b$1) {
		a.finishedWork = null;
		a.finishedLanes = 0;
		var c = a.timeoutHandle;
		-1 !== c && (a.timeoutHandle = -1, Gf(c));
		if (null !== Y) for (c = Y.return; null !== c;) {
			var d = c;
			wg(d);
			switch (d.tag) {
				case 1:
					d = d.type.childContextTypes;
					null !== d && void 0 !== d && $f();
					break;
				case 3:
					zh();
					E$1(Wf);
					E$1(H$1);
					Eh();
					break;
				case 5:
					Bh(d);
					break;
				case 4:
					zh();
					break;
				case 13:
					E$1(L);
					break;
				case 19:
					E$1(L);
					break;
				case 10:
					ah(d.type._context);
					break;
				case 22:
				case 23: Hj();
			}
			c = c.return;
		}
		Q = a;
		Y = a = Pg(a.current, null);
		Z = fj = b$1;
		T = 0;
		pk = null;
		rk = qk = rh = 0;
		tk = sk = null;
		if (null !== fh) {
			for (b$1 = 0; b$1 < fh.length; b$1++) if (c = fh[b$1], d = c.interleaved, null !== d) {
				c.interleaved = null;
				var e = d.next, f$2 = c.pending;
				if (null !== f$2) {
					var g$2 = f$2.next;
					f$2.next = e;
					d.next = g$2;
				}
				c.pending = d;
			}
			fh = null;
		}
		return a;
	}
	function Mk(a, b$1) {
		do {
			var c = Y;
			try {
				$g();
				Fh.current = Rh;
				if (Ih) {
					for (var d = M$1.memoizedState; null !== d;) {
						var e = d.queue;
						null !== e && (e.pending = null);
						d = d.next;
					}
					Ih = !1;
				}
				Hh = 0;
				O$1 = N$1 = M$1 = null;
				Jh = !1;
				Kh = 0;
				nk.current = null;
				if (null === c || null === c.return) {
					T = 1;
					pk = b$1;
					Y = null;
					break;
				}
				a: {
					var f$2 = a, g$2 = c.return, h$1 = c, k$2 = b$1;
					b$1 = Z;
					h$1.flags |= 32768;
					if (null !== k$2 && "object" === typeof k$2 && "function" === typeof k$2.then) {
						var l$3 = k$2, m$2 = h$1, q$3 = m$2.tag;
						if (0 === (m$2.mode & 1) && (0 === q$3 || 11 === q$3 || 15 === q$3)) {
							var r$3 = m$2.alternate;
							r$3 ? (m$2.updateQueue = r$3.updateQueue, m$2.memoizedState = r$3.memoizedState, m$2.lanes = r$3.lanes) : (m$2.updateQueue = null, m$2.memoizedState = null);
						}
						var y$2 = Ui(g$2);
						if (null !== y$2) {
							y$2.flags &= -257;
							Vi(y$2, g$2, h$1, f$2, b$1);
							y$2.mode & 1 && Si(f$2, l$3, b$1);
							b$1 = y$2;
							k$2 = l$3;
							var n$2 = b$1.updateQueue;
							if (null === n$2) {
								var t$2 = /* @__PURE__ */ new Set();
								t$2.add(k$2);
								b$1.updateQueue = t$2;
							} else n$2.add(k$2);
							break a;
						} else {
							if (0 === (b$1 & 1)) {
								Si(f$2, l$3, b$1);
								tj();
								break a;
							}
							k$2 = Error(p$1(426));
						}
					} else if (I$1 && h$1.mode & 1) {
						var J$3 = Ui(g$2);
						if (null !== J$3) {
							0 === (J$3.flags & 65536) && (J$3.flags |= 256);
							Vi(J$3, g$2, h$1, f$2, b$1);
							Jg(Ji(k$2, h$1));
							break a;
						}
					}
					f$2 = k$2 = Ji(k$2, h$1);
					4 !== T && (T = 2);
					null === sk ? sk = [f$2] : sk.push(f$2);
					f$2 = g$2;
					do {
						switch (f$2.tag) {
							case 3:
								f$2.flags |= 65536;
								b$1 &= -b$1;
								f$2.lanes |= b$1;
								var x$2 = Ni(f$2, k$2, b$1);
								ph(f$2, x$2);
								break a;
							case 1:
								h$1 = k$2;
								var w$1 = f$2.type, u$3 = f$2.stateNode;
								if (0 === (f$2.flags & 128) && ("function" === typeof w$1.getDerivedStateFromError || null !== u$3 && "function" === typeof u$3.componentDidCatch && (null === Ri || !Ri.has(u$3)))) {
									f$2.flags |= 65536;
									b$1 &= -b$1;
									f$2.lanes |= b$1;
									var F$2 = Qi(f$2, h$1, b$1);
									ph(f$2, F$2);
									break a;
								}
						}
						f$2 = f$2.return;
					} while (null !== f$2);
				}
				Sk(c);
			} catch (na) {
				b$1 = na;
				Y === c && null !== c && (Y = c = c.return);
				continue;
			}
			break;
		} while (1);
	}
	function Jk() {
		var a = mk.current;
		mk.current = Rh;
		return null === a ? Rh : a;
	}
	function tj() {
		if (0 === T || 3 === T || 2 === T) T = 4;
		null === Q || 0 === (rh & 268435455) && 0 === (qk & 268435455) || Ck(Q, Z);
	}
	function Ik(a, b$1) {
		var c = K;
		K |= 2;
		var d = Jk();
		if (Q !== a || Z !== b$1) uk = null, Kk(a, b$1);
		do
			try {
				Tk();
				break;
			} catch (e) {
				Mk(a, e);
			}
		while (1);
		$g();
		K = c;
		mk.current = d;
		if (null !== Y) throw Error(p$1(261));
		Q = null;
		Z = 0;
		return T;
	}
	function Tk() {
		for (; null !== Y;) Uk(Y);
	}
	function Lk() {
		for (; null !== Y && !cc();) Uk(Y);
	}
	function Uk(a) {
		var b$1 = Vk(a.alternate, a, fj);
		a.memoizedProps = a.pendingProps;
		null === b$1 ? Sk(a) : Y = b$1;
		nk.current = null;
	}
	function Sk(a) {
		var b$1 = a;
		do {
			var c = b$1.alternate;
			a = b$1.return;
			if (0 === (b$1.flags & 32768)) {
				if (c = Ej(c, b$1, fj), null !== c) {
					Y = c;
					return;
				}
			} else {
				c = Ij(c, b$1);
				if (null !== c) {
					c.flags &= 32767;
					Y = c;
					return;
				}
				if (null !== a) a.flags |= 32768, a.subtreeFlags = 0, a.deletions = null;
				else {
					T = 6;
					Y = null;
					return;
				}
			}
			b$1 = b$1.sibling;
			if (null !== b$1) {
				Y = b$1;
				return;
			}
			Y = b$1 = a;
		} while (null !== b$1);
		0 === T && (T = 5);
	}
	function Pk(a, b$1, c) {
		var d = C, e = ok.transition;
		try {
			ok.transition = null, C = 1, Wk(a, b$1, c, d);
		} finally {
			ok.transition = e, C = d;
		}
		return null;
	}
	function Wk(a, b$1, c, d) {
		do
			Hk();
		while (null !== wk);
		if (0 !== (K & 6)) throw Error(p$1(327));
		c = a.finishedWork;
		var e = a.finishedLanes;
		if (null === c) return null;
		a.finishedWork = null;
		a.finishedLanes = 0;
		if (c === a.current) throw Error(p$1(177));
		a.callbackNode = null;
		a.callbackPriority = 0;
		var f$2 = c.lanes | c.childLanes;
		Bc(a, f$2);
		a === Q && (Y = Q = null, Z = 0);
		0 === (c.subtreeFlags & 2064) && 0 === (c.flags & 2064) || vk || (vk = !0, Fk(hc, function() {
			Hk();
			return null;
		}));
		f$2 = 0 !== (c.flags & 15990);
		if (0 !== (c.subtreeFlags & 15990) || f$2) {
			f$2 = ok.transition;
			ok.transition = null;
			var g$2 = C;
			C = 1;
			var h$1 = K;
			K |= 4;
			nk.current = null;
			Oj(a, c);
			dk(c, a);
			Oe(Df);
			dd = !!Cf;
			Df = Cf = null;
			a.current = c;
			hk(c, a, e);
			dc();
			K = h$1;
			C = g$2;
			ok.transition = f$2;
		} else a.current = c;
		vk && (vk = !1, wk = a, xk = e);
		f$2 = a.pendingLanes;
		0 === f$2 && (Ri = null);
		mc(c.stateNode, d);
		Dk(a, B());
		if (null !== b$1) for (d = a.onRecoverableError, c = 0; c < b$1.length; c++) e = b$1[c], d(e.value, {
			componentStack: e.stack,
			digest: e.digest
		});
		if (Oi) throw Oi = !1, a = Pi, Pi = null, a;
		0 !== (xk & 1) && 0 !== a.tag && Hk();
		f$2 = a.pendingLanes;
		0 !== (f$2 & 1) ? a === zk ? yk++ : (yk = 0, zk = a) : yk = 0;
		jg();
		return null;
	}
	function Hk() {
		if (null !== wk) {
			var a = Dc(xk), b$1 = ok.transition, c = C;
			try {
				ok.transition = null;
				C = 16 > a ? 16 : a;
				if (null === wk) var d = !1;
				else {
					a = wk;
					wk = null;
					xk = 0;
					if (0 !== (K & 6)) throw Error(p$1(331));
					var e = K;
					K |= 4;
					for (V$1 = a.current; null !== V$1;) {
						var f$2 = V$1, g$2 = f$2.child;
						if (0 !== (V$1.flags & 16)) {
							var h$1 = f$2.deletions;
							if (null !== h$1) {
								for (var k$2 = 0; k$2 < h$1.length; k$2++) {
									var l$3 = h$1[k$2];
									for (V$1 = l$3; null !== V$1;) {
										var m$2 = V$1;
										switch (m$2.tag) {
											case 0:
											case 11:
											case 15: Pj(8, m$2, f$2);
										}
										var q$3 = m$2.child;
										if (null !== q$3) q$3.return = m$2, V$1 = q$3;
										else for (; null !== V$1;) {
											m$2 = V$1;
											var r$3 = m$2.sibling, y$2 = m$2.return;
											Sj(m$2);
											if (m$2 === l$3) {
												V$1 = null;
												break;
											}
											if (null !== r$3) {
												r$3.return = y$2;
												V$1 = r$3;
												break;
											}
											V$1 = y$2;
										}
									}
								}
								var n$2 = f$2.alternate;
								if (null !== n$2) {
									var t$2 = n$2.child;
									if (null !== t$2) {
										n$2.child = null;
										do {
											var J$3 = t$2.sibling;
											t$2.sibling = null;
											t$2 = J$3;
										} while (null !== t$2);
									}
								}
								V$1 = f$2;
							}
						}
						if (0 !== (f$2.subtreeFlags & 2064) && null !== g$2) g$2.return = f$2, V$1 = g$2;
						else b: for (; null !== V$1;) {
							f$2 = V$1;
							if (0 !== (f$2.flags & 2048)) switch (f$2.tag) {
								case 0:
								case 11:
								case 15: Pj(9, f$2, f$2.return);
							}
							var x$2 = f$2.sibling;
							if (null !== x$2) {
								x$2.return = f$2.return;
								V$1 = x$2;
								break b;
							}
							V$1 = f$2.return;
						}
					}
					var w$1 = a.current;
					for (V$1 = w$1; null !== V$1;) {
						g$2 = V$1;
						var u$3 = g$2.child;
						if (0 !== (g$2.subtreeFlags & 2064) && null !== u$3) u$3.return = g$2, V$1 = u$3;
						else b: for (g$2 = w$1; null !== V$1;) {
							h$1 = V$1;
							if (0 !== (h$1.flags & 2048)) try {
								switch (h$1.tag) {
									case 0:
									case 11:
									case 15: Qj(9, h$1);
								}
							} catch (na) {
								W$1(h$1, h$1.return, na);
							}
							if (h$1 === g$2) {
								V$1 = null;
								break b;
							}
							var F$2 = h$1.sibling;
							if (null !== F$2) {
								F$2.return = h$1.return;
								V$1 = F$2;
								break b;
							}
							V$1 = h$1.return;
						}
					}
					K = e;
					jg();
					if (lc && "function" === typeof lc.onPostCommitFiberRoot) try {
						lc.onPostCommitFiberRoot(kc, a);
					} catch (na) {}
					d = !0;
				}
				return d;
			} finally {
				C = c, ok.transition = b$1;
			}
		}
		return !1;
	}
	function Xk(a, b$1, c) {
		b$1 = Ji(c, b$1);
		b$1 = Ni(a, b$1, 1);
		a = nh(a, b$1, 1);
		b$1 = R();
		null !== a && (Ac(a, 1, b$1), Dk(a, b$1));
	}
	function W$1(a, b$1, c) {
		if (3 === a.tag) Xk(a, a, c);
		else for (; null !== b$1;) {
			if (3 === b$1.tag) {
				Xk(b$1, a, c);
				break;
			} else if (1 === b$1.tag) {
				var d = b$1.stateNode;
				if ("function" === typeof b$1.type.getDerivedStateFromError || "function" === typeof d.componentDidCatch && (null === Ri || !Ri.has(d))) {
					a = Ji(c, a);
					a = Qi(b$1, a, 1);
					b$1 = nh(b$1, a, 1);
					a = R();
					null !== b$1 && (Ac(b$1, 1, a), Dk(b$1, a));
					break;
				}
			}
			b$1 = b$1.return;
		}
	}
	function Ti(a, b$1, c) {
		var d = a.pingCache;
		null !== d && d.delete(b$1);
		b$1 = R();
		a.pingedLanes |= a.suspendedLanes & c;
		Q === a && (Z & c) === c && (4 === T || 3 === T && (Z & 130023424) === Z && 500 > B() - fk ? Kk(a, 0) : rk |= c);
		Dk(a, b$1);
	}
	function Yk(a, b$1) {
		0 === b$1 && (0 === (a.mode & 1) ? b$1 = 1 : (b$1 = sc, sc <<= 1, 0 === (sc & 130023424) && (sc = 4194304)));
		var c = R();
		a = ih(a, b$1);
		null !== a && (Ac(a, b$1, c), Dk(a, c));
	}
	function uj(a) {
		var b$1 = a.memoizedState, c = 0;
		null !== b$1 && (c = b$1.retryLane);
		Yk(a, c);
	}
	function bk(a, b$1) {
		var c = 0;
		switch (a.tag) {
			case 13:
				var d = a.stateNode;
				var e = a.memoizedState;
				null !== e && (c = e.retryLane);
				break;
			case 19:
				d = a.stateNode;
				break;
			default: throw Error(p$1(314));
		}
		null !== d && d.delete(b$1);
		Yk(a, c);
	}
	var Vk = function(a, b$1, c) {
		if (null !== a) if (a.memoizedProps !== b$1.pendingProps || Wf.current) dh = !0;
		else {
			if (0 === (a.lanes & c) && 0 === (b$1.flags & 128)) return dh = !1, yj(a, b$1, c);
			dh = 0 !== (a.flags & 131072) ? !0 : !1;
		}
		else dh = !1, I$1 && 0 !== (b$1.flags & 1048576) && ug(b$1, ng, b$1.index);
		b$1.lanes = 0;
		switch (b$1.tag) {
			case 2:
				var d = b$1.type;
				ij(a, b$1);
				a = b$1.pendingProps;
				var e = Yf(b$1, H$1.current);
				ch(b$1, c);
				e = Nh(null, b$1, d, a, e, c);
				var f$2 = Sh();
				b$1.flags |= 1;
				"object" === typeof e && null !== e && "function" === typeof e.render && void 0 === e.$$typeof ? (b$1.tag = 1, b$1.memoizedState = null, b$1.updateQueue = null, Zf(d) ? (f$2 = !0, cg(b$1)) : f$2 = !1, b$1.memoizedState = null !== e.state && void 0 !== e.state ? e.state : null, kh(b$1), e.updater = Ei, b$1.stateNode = e, e._reactInternals = b$1, Ii(b$1, d, a, c), b$1 = jj(null, b$1, d, !0, f$2, c)) : (b$1.tag = 0, I$1 && f$2 && vg(b$1), Xi(null, b$1, e, c), b$1 = b$1.child);
				return b$1;
			case 16:
				d = b$1.elementType;
				a: {
					ij(a, b$1);
					a = b$1.pendingProps;
					e = d._init;
					d = e(d._payload);
					b$1.type = d;
					e = b$1.tag = Zk(d);
					a = Ci(d, a);
					switch (e) {
						case 0:
							b$1 = cj(null, b$1, d, a, c);
							break a;
						case 1:
							b$1 = hj(null, b$1, d, a, c);
							break a;
						case 11:
							b$1 = Yi(null, b$1, d, a, c);
							break a;
						case 14:
							b$1 = $i(null, b$1, d, Ci(d.type, a), c);
							break a;
					}
					throw Error(p$1(306, d, ""));
				}
				return b$1;
			case 0: return d = b$1.type, e = b$1.pendingProps, e = b$1.elementType === d ? e : Ci(d, e), cj(a, b$1, d, e, c);
			case 1: return d = b$1.type, e = b$1.pendingProps, e = b$1.elementType === d ? e : Ci(d, e), hj(a, b$1, d, e, c);
			case 3:
				a: {
					kj(b$1);
					if (null === a) throw Error(p$1(387));
					d = b$1.pendingProps;
					f$2 = b$1.memoizedState;
					e = f$2.element;
					lh(a, b$1);
					qh(b$1, d, null, c);
					var g$2 = b$1.memoizedState;
					d = g$2.element;
					if (f$2.isDehydrated) if (f$2 = {
						element: d,
						isDehydrated: !1,
						cache: g$2.cache,
						pendingSuspenseBoundaries: g$2.pendingSuspenseBoundaries,
						transitions: g$2.transitions
					}, b$1.updateQueue.baseState = f$2, b$1.memoizedState = f$2, b$1.flags & 256) {
						e = Ji(Error(p$1(423)), b$1);
						b$1 = lj(a, b$1, d, c, e);
						break a;
					} else if (d !== e) {
						e = Ji(Error(p$1(424)), b$1);
						b$1 = lj(a, b$1, d, c, e);
						break a;
					} else for (yg = Lf(b$1.stateNode.containerInfo.firstChild), xg = b$1, I$1 = !0, zg = null, c = Vg(b$1, null, d, c), b$1.child = c; c;) c.flags = c.flags & -3 | 4096, c = c.sibling;
					else {
						Ig();
						if (d === e) {
							b$1 = Zi(a, b$1, c);
							break a;
						}
						Xi(a, b$1, d, c);
					}
					b$1 = b$1.child;
				}
				return b$1;
			case 5: return Ah(b$1), null === a && Eg(b$1), d = b$1.type, e = b$1.pendingProps, f$2 = null !== a ? a.memoizedProps : null, g$2 = e.children, Ef(d, e) ? g$2 = null : null !== f$2 && Ef(d, f$2) && (b$1.flags |= 32), gj(a, b$1), Xi(a, b$1, g$2, c), b$1.child;
			case 6: return null === a && Eg(b$1), null;
			case 13: return oj(a, b$1, c);
			case 4: return yh(b$1, b$1.stateNode.containerInfo), d = b$1.pendingProps, null === a ? b$1.child = Ug(b$1, null, d, c) : Xi(a, b$1, d, c), b$1.child;
			case 11: return d = b$1.type, e = b$1.pendingProps, e = b$1.elementType === d ? e : Ci(d, e), Yi(a, b$1, d, e, c);
			case 7: return Xi(a, b$1, b$1.pendingProps, c), b$1.child;
			case 8: return Xi(a, b$1, b$1.pendingProps.children, c), b$1.child;
			case 12: return Xi(a, b$1, b$1.pendingProps.children, c), b$1.child;
			case 10:
				a: {
					d = b$1.type._context;
					e = b$1.pendingProps;
					f$2 = b$1.memoizedProps;
					g$2 = e.value;
					G(Wg, d._currentValue);
					d._currentValue = g$2;
					if (null !== f$2) if (He(f$2.value, g$2)) {
						if (f$2.children === e.children && !Wf.current) {
							b$1 = Zi(a, b$1, c);
							break a;
						}
					} else for (f$2 = b$1.child, null !== f$2 && (f$2.return = b$1); null !== f$2;) {
						var h$1 = f$2.dependencies;
						if (null !== h$1) {
							g$2 = f$2.child;
							for (var k$2 = h$1.firstContext; null !== k$2;) {
								if (k$2.context === d) {
									if (1 === f$2.tag) {
										k$2 = mh(-1, c & -c);
										k$2.tag = 2;
										var l$3 = f$2.updateQueue;
										if (null !== l$3) {
											l$3 = l$3.shared;
											var m$2 = l$3.pending;
											null === m$2 ? k$2.next = k$2 : (k$2.next = m$2.next, m$2.next = k$2);
											l$3.pending = k$2;
										}
									}
									f$2.lanes |= c;
									k$2 = f$2.alternate;
									null !== k$2 && (k$2.lanes |= c);
									bh(f$2.return, c, b$1);
									h$1.lanes |= c;
									break;
								}
								k$2 = k$2.next;
							}
						} else if (10 === f$2.tag) g$2 = f$2.type === b$1.type ? null : f$2.child;
						else if (18 === f$2.tag) {
							g$2 = f$2.return;
							if (null === g$2) throw Error(p$1(341));
							g$2.lanes |= c;
							h$1 = g$2.alternate;
							null !== h$1 && (h$1.lanes |= c);
							bh(g$2, c, b$1);
							g$2 = f$2.sibling;
						} else g$2 = f$2.child;
						if (null !== g$2) g$2.return = f$2;
						else for (g$2 = f$2; null !== g$2;) {
							if (g$2 === b$1) {
								g$2 = null;
								break;
							}
							f$2 = g$2.sibling;
							if (null !== f$2) {
								f$2.return = g$2.return;
								g$2 = f$2;
								break;
							}
							g$2 = g$2.return;
						}
						f$2 = g$2;
					}
					Xi(a, b$1, e.children, c);
					b$1 = b$1.child;
				}
				return b$1;
			case 9: return e = b$1.type, d = b$1.pendingProps.children, ch(b$1, c), e = eh(e), d = d(e), b$1.flags |= 1, Xi(a, b$1, d, c), b$1.child;
			case 14: return d = b$1.type, e = Ci(d, b$1.pendingProps), e = Ci(d.type, e), $i(a, b$1, d, e, c);
			case 15: return bj(a, b$1, b$1.type, b$1.pendingProps, c);
			case 17: return d = b$1.type, e = b$1.pendingProps, e = b$1.elementType === d ? e : Ci(d, e), ij(a, b$1), b$1.tag = 1, Zf(d) ? (a = !0, cg(b$1)) : a = !1, ch(b$1, c), Gi(b$1, d, e), Ii(b$1, d, e, c), jj(null, b$1, d, !0, a, c);
			case 19: return xj(a, b$1, c);
			case 22: return dj(a, b$1, c);
		}
		throw Error(p$1(156, b$1.tag));
	};
	function Fk(a, b$1) {
		return ac(a, b$1);
	}
	function $k(a, b$1, c, d) {
		this.tag = a;
		this.key = c;
		this.sibling = this.child = this.return = this.stateNode = this.type = this.elementType = null;
		this.index = 0;
		this.ref = null;
		this.pendingProps = b$1;
		this.dependencies = this.memoizedState = this.updateQueue = this.memoizedProps = null;
		this.mode = d;
		this.subtreeFlags = this.flags = 0;
		this.deletions = null;
		this.childLanes = this.lanes = 0;
		this.alternate = null;
	}
	function Bg(a, b$1, c, d) {
		return new $k(a, b$1, c, d);
	}
	function aj(a) {
		a = a.prototype;
		return !(!a || !a.isReactComponent);
	}
	function Zk(a) {
		if ("function" === typeof a) return aj(a) ? 1 : 0;
		if (void 0 !== a && null !== a) {
			a = a.$$typeof;
			if (a === Da) return 11;
			if (a === Ga) return 14;
		}
		return 2;
	}
	function Pg(a, b$1) {
		var c = a.alternate;
		null === c ? (c = Bg(a.tag, b$1, a.key, a.mode), c.elementType = a.elementType, c.type = a.type, c.stateNode = a.stateNode, c.alternate = a, a.alternate = c) : (c.pendingProps = b$1, c.type = a.type, c.flags = 0, c.subtreeFlags = 0, c.deletions = null);
		c.flags = a.flags & 14680064;
		c.childLanes = a.childLanes;
		c.lanes = a.lanes;
		c.child = a.child;
		c.memoizedProps = a.memoizedProps;
		c.memoizedState = a.memoizedState;
		c.updateQueue = a.updateQueue;
		b$1 = a.dependencies;
		c.dependencies = null === b$1 ? null : {
			lanes: b$1.lanes,
			firstContext: b$1.firstContext
		};
		c.sibling = a.sibling;
		c.index = a.index;
		c.ref = a.ref;
		return c;
	}
	function Rg(a, b$1, c, d, e, f$2) {
		var g$2 = 2;
		d = a;
		if ("function" === typeof a) aj(a) && (g$2 = 1);
		else if ("string" === typeof a) g$2 = 5;
		else a: switch (a) {
			case ya: return Tg(c.children, e, f$2, b$1);
			case za:
				g$2 = 8;
				e |= 8;
				break;
			case Aa: return a = Bg(12, c, b$1, e | 2), a.elementType = Aa, a.lanes = f$2, a;
			case Ea: return a = Bg(13, c, b$1, e), a.elementType = Ea, a.lanes = f$2, a;
			case Fa: return a = Bg(19, c, b$1, e), a.elementType = Fa, a.lanes = f$2, a;
			case Ia: return pj(c, e, f$2, b$1);
			default:
				if ("object" === typeof a && null !== a) switch (a.$$typeof) {
					case Ba:
						g$2 = 10;
						break a;
					case Ca:
						g$2 = 9;
						break a;
					case Da:
						g$2 = 11;
						break a;
					case Ga:
						g$2 = 14;
						break a;
					case Ha:
						g$2 = 16;
						d = null;
						break a;
				}
				throw Error(p$1(130, null == a ? a : typeof a, ""));
		}
		b$1 = Bg(g$2, c, b$1, e);
		b$1.elementType = a;
		b$1.type = d;
		b$1.lanes = f$2;
		return b$1;
	}
	function Tg(a, b$1, c, d) {
		a = Bg(7, a, d, b$1);
		a.lanes = c;
		return a;
	}
	function pj(a, b$1, c, d) {
		a = Bg(22, a, d, b$1);
		a.elementType = Ia;
		a.lanes = c;
		a.stateNode = { isHidden: !1 };
		return a;
	}
	function Qg(a, b$1, c) {
		a = Bg(6, a, null, b$1);
		a.lanes = c;
		return a;
	}
	function Sg(a, b$1, c) {
		b$1 = Bg(4, null !== a.children ? a.children : [], a.key, b$1);
		b$1.lanes = c;
		b$1.stateNode = {
			containerInfo: a.containerInfo,
			pendingChildren: null,
			implementation: a.implementation
		};
		return b$1;
	}
	function al(a, b$1, c, d, e) {
		this.tag = b$1;
		this.containerInfo = a;
		this.finishedWork = this.pingCache = this.current = this.pendingChildren = null;
		this.timeoutHandle = -1;
		this.callbackNode = this.pendingContext = this.context = null;
		this.callbackPriority = 0;
		this.eventTimes = zc(0);
		this.expirationTimes = zc(-1);
		this.entangledLanes = this.finishedLanes = this.mutableReadLanes = this.expiredLanes = this.pingedLanes = this.suspendedLanes = this.pendingLanes = 0;
		this.entanglements = zc(0);
		this.identifierPrefix = d;
		this.onRecoverableError = e;
		this.mutableSourceEagerHydrationData = null;
	}
	function bl(a, b$1, c, d, e, f$2, g$2, h$1, k$2) {
		a = new al(a, b$1, c, h$1, k$2);
		1 === b$1 ? (b$1 = 1, !0 === f$2 && (b$1 |= 8)) : b$1 = 0;
		f$2 = Bg(3, null, null, b$1);
		a.current = f$2;
		f$2.stateNode = a;
		f$2.memoizedState = {
			element: d,
			isDehydrated: c,
			cache: null,
			transitions: null,
			pendingSuspenseBoundaries: null
		};
		kh(f$2);
		return a;
	}
	function cl(a, b$1, c) {
		var d = 3 < arguments.length && void 0 !== arguments[3] ? arguments[3] : null;
		return {
			$$typeof: wa,
			key: null == d ? null : "" + d,
			children: a,
			containerInfo: b$1,
			implementation: c
		};
	}
	function dl(a) {
		if (!a) return Vf;
		a = a._reactInternals;
		a: {
			if (Vb(a) !== a || 1 !== a.tag) throw Error(p$1(170));
			var b$1 = a;
			do {
				switch (b$1.tag) {
					case 3:
						b$1 = b$1.stateNode.context;
						break a;
					case 1: if (Zf(b$1.type)) {
						b$1 = b$1.stateNode.__reactInternalMemoizedMergedChildContext;
						break a;
					}
				}
				b$1 = b$1.return;
			} while (null !== b$1);
			throw Error(p$1(171));
		}
		if (1 === a.tag) {
			var c = a.type;
			if (Zf(c)) return bg(a, c, b$1);
		}
		return b$1;
	}
	function el(a, b$1, c, d, e, f$2, g$2, h$1, k$2) {
		a = bl(c, d, !0, a, e, f$2, g$2, h$1, k$2);
		a.context = dl(null);
		c = a.current;
		d = R();
		e = yi(c);
		f$2 = mh(d, e);
		f$2.callback = void 0 !== b$1 && null !== b$1 ? b$1 : null;
		nh(c, f$2, e);
		a.current.lanes = e;
		Ac(a, e, d);
		Dk(a, d);
		return a;
	}
	function fl(a, b$1, c, d) {
		var e = b$1.current, f$2 = R(), g$2 = yi(e);
		c = dl(c);
		null === b$1.context ? b$1.context = c : b$1.pendingContext = c;
		b$1 = mh(f$2, g$2);
		b$1.payload = { element: a };
		d = void 0 === d ? null : d;
		null !== d && (b$1.callback = d);
		a = nh(e, b$1, g$2);
		null !== a && (gi(a, e, g$2, f$2), oh(a, e, g$2));
		return g$2;
	}
	function gl(a) {
		a = a.current;
		if (!a.child) return null;
		switch (a.child.tag) {
			case 5: return a.child.stateNode;
			default: return a.child.stateNode;
		}
	}
	function hl(a, b$1) {
		a = a.memoizedState;
		if (null !== a && null !== a.dehydrated) {
			var c = a.retryLane;
			a.retryLane = 0 !== c && c < b$1 ? c : b$1;
		}
	}
	function il(a, b$1) {
		hl(a, b$1);
		(a = a.alternate) && hl(a, b$1);
	}
	function jl() {
		return null;
	}
	var kl = "function" === typeof reportError ? reportError : function(a) {
		console.error(a);
	};
	function ll(a) {
		this._internalRoot = a;
	}
	ml.prototype.render = ll.prototype.render = function(a) {
		var b$1 = this._internalRoot;
		if (null === b$1) throw Error(p$1(409));
		fl(a, b$1, null, null);
	};
	ml.prototype.unmount = ll.prototype.unmount = function() {
		var a = this._internalRoot;
		if (null !== a) {
			this._internalRoot = null;
			var b$1 = a.containerInfo;
			Rk(function() {
				fl(null, a, null, null);
			});
			b$1[uf] = null;
		}
	};
	function ml(a) {
		this._internalRoot = a;
	}
	ml.prototype.unstable_scheduleHydration = function(a) {
		if (a) {
			var b$1 = Hc();
			a = {
				blockedOn: null,
				target: a,
				priority: b$1
			};
			for (var c = 0; c < Qc.length && 0 !== b$1 && b$1 < Qc[c].priority; c++);
			Qc.splice(c, 0, a);
			0 === c && Vc(a);
		}
	};
	function nl(a) {
		return !(!a || 1 !== a.nodeType && 9 !== a.nodeType && 11 !== a.nodeType);
	}
	function ol(a) {
		return !(!a || 1 !== a.nodeType && 9 !== a.nodeType && 11 !== a.nodeType && (8 !== a.nodeType || " react-mount-point-unstable " !== a.nodeValue));
	}
	function pl() {}
	function ql(a, b$1, c, d, e) {
		if (e) {
			if ("function" === typeof d) {
				var f$2 = d;
				d = function() {
					var a$1 = gl(g$2);
					f$2.call(a$1);
				};
			}
			var g$2 = el(b$1, d, a, 0, null, !1, !1, "", pl);
			a._reactRootContainer = g$2;
			a[uf] = g$2.current;
			sf(8 === a.nodeType ? a.parentNode : a);
			Rk();
			return g$2;
		}
		for (; e = a.lastChild;) a.removeChild(e);
		if ("function" === typeof d) {
			var h$1 = d;
			d = function() {
				var a$1 = gl(k$2);
				h$1.call(a$1);
			};
		}
		var k$2 = bl(a, 0, !1, null, null, !1, !1, "", pl);
		a._reactRootContainer = k$2;
		a[uf] = k$2.current;
		sf(8 === a.nodeType ? a.parentNode : a);
		Rk(function() {
			fl(b$1, k$2, c, d);
		});
		return k$2;
	}
	function rl(a, b$1, c, d, e) {
		var f$2 = c._reactRootContainer;
		if (f$2) {
			var g$2 = f$2;
			if ("function" === typeof e) {
				var h$1 = e;
				e = function() {
					var a$1 = gl(g$2);
					h$1.call(a$1);
				};
			}
			fl(b$1, g$2, a, e);
		} else g$2 = ql(c, b$1, a, e, d);
		return gl(g$2);
	}
	Ec = function(a) {
		switch (a.tag) {
			case 3:
				var b$1 = a.stateNode;
				if (b$1.current.memoizedState.isDehydrated) {
					var c = tc(b$1.pendingLanes);
					0 !== c && (Cc(b$1, c | 1), Dk(b$1, B()), 0 === (K & 6) && (Gj = B() + 500, jg()));
				}
				break;
			case 13: Rk(function() {
				var b$2 = ih(a, 1);
				if (null !== b$2) gi(b$2, a, 1, R());
			}), il(a, 1);
		}
	};
	Fc = function(a) {
		if (13 === a.tag) {
			var b$1 = ih(a, 134217728);
			if (null !== b$1) gi(b$1, a, 134217728, R());
			il(a, 134217728);
		}
	};
	Gc = function(a) {
		if (13 === a.tag) {
			var b$1 = yi(a), c = ih(a, b$1);
			if (null !== c) gi(c, a, b$1, R());
			il(a, b$1);
		}
	};
	Hc = function() {
		return C;
	};
	Ic = function(a, b$1) {
		var c = C;
		try {
			return C = a, b$1();
		} finally {
			C = c;
		}
	};
	yb = function(a, b$1, c) {
		switch (b$1) {
			case "input":
				bb(a, c);
				b$1 = c.name;
				if ("radio" === c.type && null != b$1) {
					for (c = a; c.parentNode;) c = c.parentNode;
					c = c.querySelectorAll("input[name=" + JSON.stringify("" + b$1) + "][type=\"radio\"]");
					for (b$1 = 0; b$1 < c.length; b$1++) {
						var d = c[b$1];
						if (d !== a && d.form === a.form) {
							var e = Db(d);
							if (!e) throw Error(p$1(90));
							Wa(d);
							bb(d, e);
						}
					}
				}
				break;
			case "textarea":
				ib(a, c);
				break;
			case "select": b$1 = c.value, null != b$1 && fb(a, !!c.multiple, b$1, !1);
		}
	};
	Gb = Qk;
	Hb = Rk;
	var sl = {
		usingClientEntryPoint: !1,
		Events: [
			Cb,
			ue,
			Db,
			Eb,
			Fb,
			Qk
		]
	}, tl = {
		findFiberByHostInstance: Wc,
		bundleType: 0,
		version: "18.3.1",
		rendererPackageName: "react-dom"
	};
	var ul = {
		bundleType: tl.bundleType,
		version: tl.version,
		rendererPackageName: tl.rendererPackageName,
		rendererConfig: tl.rendererConfig,
		overrideHookState: null,
		overrideHookStateDeletePath: null,
		overrideHookStateRenamePath: null,
		overrideProps: null,
		overridePropsDeletePath: null,
		overridePropsRenamePath: null,
		setErrorHandler: null,
		setSuspenseHandler: null,
		scheduleUpdate: null,
		currentDispatcherRef: ua.ReactCurrentDispatcher,
		findHostInstanceByFiber: function(a) {
			a = Zb(a);
			return null === a ? null : a.stateNode;
		},
		findFiberByHostInstance: tl.findFiberByHostInstance || jl,
		findHostInstancesForRefresh: null,
		scheduleRefresh: null,
		scheduleRoot: null,
		setRefreshHandler: null,
		getCurrentFiber: null,
		reconcilerVersion: "18.3.1-next-f1338f8080-20240426"
	};
	if ("undefined" !== typeof __REACT_DEVTOOLS_GLOBAL_HOOK__) {
		var vl = __REACT_DEVTOOLS_GLOBAL_HOOK__;
		if (!vl.isDisabled && vl.supportsFiber) try {
			kc = vl.inject(ul), lc = vl;
		} catch (a) {}
	}
	exports.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = sl;
	exports.createPortal = function(a, b$1) {
		var c = 2 < arguments.length && void 0 !== arguments[2] ? arguments[2] : null;
		if (!nl(b$1)) throw Error(p$1(200));
		return cl(a, b$1, null, c);
	};
	exports.createRoot = function(a, b$1) {
		if (!nl(a)) throw Error(p$1(299));
		var c = !1, d = "", e = kl;
		null !== b$1 && void 0 !== b$1 && (!0 === b$1.unstable_strictMode && (c = !0), void 0 !== b$1.identifierPrefix && (d = b$1.identifierPrefix), void 0 !== b$1.onRecoverableError && (e = b$1.onRecoverableError));
		b$1 = bl(a, 1, !1, null, null, c, !1, d, e);
		a[uf] = b$1.current;
		sf(8 === a.nodeType ? a.parentNode : a);
		return new ll(b$1);
	};
	exports.findDOMNode = function(a) {
		if (null == a) return null;
		if (1 === a.nodeType) return a;
		var b$1 = a._reactInternals;
		if (void 0 === b$1) {
			if ("function" === typeof a.render) throw Error(p$1(188));
			a = Object.keys(a).join(",");
			throw Error(p$1(268, a));
		}
		a = Zb(b$1);
		a = null === a ? null : a.stateNode;
		return a;
	};
	exports.flushSync = function(a) {
		return Rk(a);
	};
	exports.hydrate = function(a, b$1, c) {
		if (!ol(b$1)) throw Error(p$1(200));
		return rl(null, a, b$1, !0, c);
	};
	exports.hydrateRoot = function(a, b$1, c) {
		if (!nl(a)) throw Error(p$1(405));
		var d = null != c && c.hydratedSources || null, e = !1, f$2 = "", g$2 = kl;
		null !== c && void 0 !== c && (!0 === c.unstable_strictMode && (e = !0), void 0 !== c.identifierPrefix && (f$2 = c.identifierPrefix), void 0 !== c.onRecoverableError && (g$2 = c.onRecoverableError));
		b$1 = el(b$1, null, a, 1, null != c ? c : null, e, !1, f$2, g$2);
		a[uf] = b$1.current;
		sf(a);
		if (d) for (a = 0; a < d.length; a++) c = d[a], e = c._getVersion, e = e(c._source), null == b$1.mutableSourceEagerHydrationData ? b$1.mutableSourceEagerHydrationData = [c, e] : b$1.mutableSourceEagerHydrationData.push(c, e);
		return new ml(b$1);
	};
	exports.render = function(a, b$1, c) {
		if (!ol(b$1)) throw Error(p$1(200));
		return rl(null, a, b$1, !1, c);
	};
	exports.unmountComponentAtNode = function(a) {
		if (!ol(a)) throw Error(p$1(40));
		return a._reactRootContainer ? (Rk(function() {
			rl(null, null, a, !1, function() {
				a._reactRootContainer = null;
				a[uf] = null;
			});
		}), !0) : !1;
	};
	exports.unstable_batchedUpdates = Qk;
	exports.unstable_renderSubtreeIntoContainer = function(a, b$1, c, d) {
		if (!ol(c)) throw Error(p$1(200));
		if (null == a || void 0 === a._reactInternals) throw Error(p$1(38));
		return rl(a, b$1, c, !1, d);
	};
	exports.version = "18.3.1-next-f1338f8080-20240426";
}));
var require_react_dom = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	function checkDCE() {
		if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ === "undefined" || typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE !== "function") return;
		try {
			__REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(checkDCE);
		} catch (err) {
			console.error(err);
		}
	}
	checkDCE();
	module.exports = require_react_dom_production_min();
}));
var require_client = /* @__PURE__ */ __commonJSMin(((exports) => {
	var m$1 = require_react_dom();
	exports.createRoot = m$1.createRoot;
	exports.hydrateRoot = m$1.hydrateRoot;
}));
var scriptRel = "modulepreload";
var assetsURL = function(dep) {
	return "/" + dep;
};
var seen = {};
const __vitePreload = function preload(baseModule, deps, importerUrl) {
	let promise = Promise.resolve();
	if (deps && deps.length > 0) {
		const links = document.getElementsByTagName("link");
		const cspNonceMeta = document.querySelector("meta[property=csp-nonce]");
		const cspNonce = cspNonceMeta?.nonce || cspNonceMeta?.getAttribute("nonce");
		function allSettled(promises$2) {
			return Promise.all(promises$2.map((p$4) => Promise.resolve(p$4).then((value$1) => ({
				status: "fulfilled",
				value: value$1
			}), (reason) => ({
				status: "rejected",
				reason
			}))));
		}
		promise = allSettled(deps.map((dep) => {
			dep = assetsURL(dep, importerUrl);
			if (dep in seen) return;
			seen[dep] = true;
			const isCss = dep.endsWith(".css");
			const cssSelector = isCss ? "[rel=\"stylesheet\"]" : "";
			if (!!importerUrl) for (let i$1 = links.length - 1; i$1 >= 0; i$1--) {
				const link$1 = links[i$1];
				if (link$1.href === dep && (!isCss || link$1.rel === "stylesheet")) return;
			}
			else if (document.querySelector(`link[href="${dep}"]${cssSelector}`)) return;
			const link = document.createElement("link");
			link.rel = isCss ? "stylesheet" : scriptRel;
			if (!isCss) link.as = "script";
			link.crossOrigin = "";
			link.href = dep;
			if (cspNonce) link.setAttribute("nonce", cspNonce);
			document.head.appendChild(link);
			if (isCss) return new Promise((res, rej) => {
				link.addEventListener("load", res);
				link.addEventListener("error", () => rej(/* @__PURE__ */ new Error(`Unable to preload CSS for ${dep}`)));
			});
		}));
	}
	function handlePreloadError(err$2) {
		const e$1 = new Event("vite:preloadError", { cancelable: true });
		e$1.payload = err$2;
		window.dispatchEvent(e$1);
		if (!e$1.defaultPrevented) throw err$2;
	}
	return promise.then((res) => {
		for (const item of res || []) {
			if (item.status !== "rejected") continue;
			handlePreloadError(item.reason);
		}
		return baseModule().catch(handlePreloadError);
	});
};
var ABSOLUTE_URL_REGEX = /^(?:[a-z][a-z0-9+.-]*:|[\\/]{2})/i;
var PROTOCOL_RELATIVE_URL_REGEX = /^[\\/]{2}/;
function normalizeProtocolRelativeUrl(url, protocol) {
	return protocol + url.replace(/\\/g, "/");
}
var PopStateEventType = "popstate";
function isLocation(obj) {
	return typeof obj === "object" && obj != null && "pathname" in obj && "search" in obj && "hash" in obj && "state" in obj && "key" in obj;
}
function createHashHistory(options = {}) {
	function createHashLocation(window2, globalHistory) {
		let { pathname = "/", search = "", hash = "" } = parsePath(window2.location.hash.substring(1));
		if (!pathname.startsWith("/") && !pathname.startsWith(".")) pathname = "/" + pathname;
		return createLocation("", {
			pathname,
			search,
			hash
		}, globalHistory.state && globalHistory.state.usr || null, globalHistory.state && globalHistory.state.key || "default");
	}
	function createHashHref(window2, to) {
		let base = window2.document.querySelector("base");
		let href = "";
		if (base && base.getAttribute("href")) {
			let url = window2.location.href;
			let hashIndex = url.indexOf("#");
			href = hashIndex === -1 ? url : url.slice(0, hashIndex);
		}
		return href + "#" + (typeof to === "string" ? to : createPath(to));
	}
	function validateHashLocation(location, to) {
		warning(location.pathname.charAt(0) === "/", `relative pathnames are not supported in hash history.push(${JSON.stringify(to)})`);
	}
	return getUrlBasedHistory(createHashLocation, createHashHref, validateHashLocation, options);
}
function invariant$2(value, message) {
	if (value === false || value === null || typeof value === "undefined") throw new Error(message);
}
function warning(cond, message) {
	if (!cond) {
		if (typeof console !== "undefined") console.warn(message);
		try {
			throw new Error(message);
		} catch (e) {}
	}
}
function createKey() {
	return Math.random().toString(36).substring(2, 10);
}
function getHistoryState(location, index$1) {
	return {
		usr: location.state,
		key: location.key,
		idx: index$1,
		masked: location.mask ? {
			pathname: location.pathname,
			search: location.search,
			hash: location.hash
		} : void 0
	};
}
function createLocation(current, to, state = null, key, mask) {
	return {
		pathname: typeof current === "string" ? current : current.pathname,
		search: "",
		hash: "",
		...typeof to === "string" ? parsePath(to) : to,
		state,
		key: to && to.key || key || createKey(),
		mask
	};
}
function createPath({ pathname = "/", search = "", hash = "" }) {
	if (search && search !== "?") pathname += search.charAt(0) === "?" ? search : "?" + search;
	if (hash && hash !== "#") pathname += hash.charAt(0) === "#" ? hash : "#" + hash;
	return pathname;
}
function parsePath(path) {
	let parsedPath = {};
	if (path) {
		let hashIndex = path.indexOf("#");
		if (hashIndex >= 0) {
			parsedPath.hash = path.substring(hashIndex);
			path = path.substring(0, hashIndex);
		}
		let searchIndex = path.indexOf("?");
		if (searchIndex >= 0) {
			parsedPath.search = path.substring(searchIndex);
			path = path.substring(0, searchIndex);
		}
		if (path) parsedPath.pathname = path;
	}
	return parsedPath;
}
function getUrlBasedHistory(getLocation, createHref2, validateLocation, options = {}) {
	let { window: window2 = document.defaultView, v5Compat = false } = options;
	let globalHistory = window2.history;
	let action = "POP";
	let listener = null;
	let index$1 = getIndex();
	if (index$1 == null) {
		index$1 = 0;
		globalHistory.replaceState({
			...globalHistory.state,
			idx: index$1
		}, "");
	}
	function getIndex() {
		return (globalHistory.state || { idx: null }).idx;
	}
	function handlePop() {
		action = "POP";
		let nextIndex = getIndex();
		let delta = nextIndex == null ? null : nextIndex - index$1;
		index$1 = nextIndex;
		if (listener) listener({
			action,
			location: history.location,
			delta
		});
	}
	function push(to, state) {
		action = "PUSH";
		let location = isLocation(to) ? to : createLocation(history.location, to, state);
		if (validateLocation) validateLocation(location, to);
		index$1 = getIndex() + 1;
		let historyState = getHistoryState(location, index$1);
		let url = history.createHref(location.mask || location);
		try {
			globalHistory.pushState(historyState, "", url);
		} catch (error$1) {
			if (error$1 instanceof DOMException && error$1.name === "DataCloneError") throw error$1;
			window2.location.assign(url);
		}
		if (v5Compat && listener) listener({
			action,
			location: history.location,
			delta: 1
		});
	}
	function replace2(to, state) {
		action = "REPLACE";
		let location = isLocation(to) ? to : createLocation(history.location, to, state);
		if (validateLocation) validateLocation(location, to);
		index$1 = getIndex();
		let historyState = getHistoryState(location, index$1);
		let url = history.createHref(location.mask || location);
		globalHistory.replaceState(historyState, "", url);
		if (v5Compat && listener) listener({
			action,
			location: history.location,
			delta: 0
		});
	}
	function createURL(to) {
		return createBrowserURLImpl(window2, to);
	}
	let history = {
		get action() {
			return action;
		},
		get location() {
			return getLocation(window2, globalHistory);
		},
		listen(fn) {
			if (listener) throw new Error("A history only accepts one active listener");
			window2.addEventListener(PopStateEventType, handlePop);
			listener = fn;
			return () => {
				window2.removeEventListener(PopStateEventType, handlePop);
				listener = null;
			};
		},
		createHref(to) {
			return createHref2(window2, to);
		},
		createURL,
		encodeLocation(to) {
			let url = createURL(to);
			return {
				pathname: url.pathname,
				search: url.search,
				hash: url.hash
			};
		},
		push,
		replace: replace2,
		go(n$2) {
			return globalHistory.go(n$2);
		}
	};
	return history;
}
function createBrowserURLImpl(windowImpl, to, isAbsolute = false) {
	let base = "http://localhost";
	if (windowImpl) base = windowImpl.location.origin !== "null" ? windowImpl.location.origin : windowImpl.location.href;
	invariant$2(base, "No window.location.(origin|href) available to create URL");
	let href = typeof to === "string" ? to : createPath(to);
	href = href.replace(/ $/, "%20");
	if (!isAbsolute && PROTOCOL_RELATIVE_URL_REGEX.test(href)) href = base + href;
	return new URL(href, base);
}
function matchRoutes(routes$1, locationArg, basename = "/") {
	return matchRoutesImpl(routes$1, locationArg, basename, false);
}
function matchRoutesImpl(routes$1, locationArg, basename, allowPartial, precomputedBranches) {
	let pathname = stripBasename((typeof locationArg === "string" ? parsePath(locationArg) : locationArg).pathname || "/", basename);
	if (pathname == null) return null;
	let branches = precomputedBranches ?? flattenAndRankRoutes(routes$1);
	let matches = null;
	let decoded = decodePath(pathname);
	for (let i = 0; matches == null && i < branches.length; ++i) matches = matchRouteBranch(branches[i], decoded, allowPartial);
	return matches;
}
function convertRouteMatchToUiMatch(match, loaderData) {
	let { route, pathname, params } = match;
	return {
		id: route.id,
		pathname,
		params,
		data: loaderData[route.id],
		loaderData: loaderData[route.id],
		handle: route.handle
	};
}
function flattenAndRankRoutes(routes$1) {
	let branches = flattenRoutes(routes$1);
	rankRouteBranches(branches);
	return branches;
}
function flattenRoutes(routes$1, branches = [], parentsMeta = [], parentPath = "", _hasParentOptionalSegments = false) {
	let flattenRoute = (route, index$1, hasParentOptionalSegments = _hasParentOptionalSegments, relativePath) => {
		let meta = {
			relativePath: relativePath === void 0 ? route.path || "" : relativePath,
			caseSensitive: route.caseSensitive === true,
			childrenIndex: index$1,
			route
		};
		if (meta.relativePath.startsWith("/")) {
			if (!meta.relativePath.startsWith(parentPath) && hasParentOptionalSegments) return;
			invariant$2(meta.relativePath.startsWith(parentPath), `Absolute route path "${meta.relativePath}" nested under path "${parentPath}" is not valid. An absolute child route path must start with the combined path of all its parent routes.`);
			meta.relativePath = meta.relativePath.slice(parentPath.length);
		}
		let path = joinPaths([parentPath, meta.relativePath]);
		let routesMeta = parentsMeta.concat(meta);
		if (route.children && route.children.length > 0) {
			invariant$2(route.index !== true, `Index routes must not have child routes. Please remove all child routes from route path "${path}".`);
			flattenRoutes(route.children, branches, routesMeta, path, hasParentOptionalSegments);
		}
		if (route.path == null && !route.index) return;
		branches.push({
			path,
			score: computeScore(path, route.index),
			routesMeta: routesMeta.map((meta2, i) => {
				let [matcher, params] = compilePath(meta2.relativePath, meta2.caseSensitive, i === routesMeta.length - 1);
				return {
					...meta2,
					matcher,
					compiledParams: params
				};
			})
		});
	};
	routes$1.forEach((route, index$1) => {
		if (route.path === "" || !route.path?.includes("?")) flattenRoute(route, index$1);
		else for (let exploded of explodeOptionalSegments(route.path)) flattenRoute(route, index$1, true, exploded);
	});
	return branches;
}
function explodeOptionalSegments(path) {
	let segments = path.split("/");
	if (segments.length === 0) return [];
	let [first, ...rest] = segments;
	let isOptional = first.endsWith("?");
	let required = first.replace(/\?$/, "");
	if (rest.length === 0) return isOptional ? [required, ""] : [required];
	let restExploded = explodeOptionalSegments(rest.join("/"));
	let result = [];
	result.push(...restExploded.map((subpath) => subpath === "" ? required : [required, subpath].join("/")));
	if (isOptional) result.push(...restExploded);
	return result.map((exploded) => path.startsWith("/") && exploded === "" ? "/" : exploded);
}
function rankRouteBranches(branches) {
	branches.sort((a, b$1) => a.score !== b$1.score ? b$1.score - a.score : compareIndexes(a.routesMeta.map((meta) => meta.childrenIndex), b$1.routesMeta.map((meta) => meta.childrenIndex)));
}
var paramRe = /^:[\w-]+$/;
var dynamicSegmentValue = 3;
var indexRouteValue = 2;
var emptySegmentValue = 1;
var staticSegmentValue = 10;
var splatPenalty = -2;
var isSplat = (s) => s === "*";
function computeScore(path, index$1) {
	let segments = path.split("/");
	let initialScore = segments.length;
	if (segments.some(isSplat)) initialScore += splatPenalty;
	if (index$1) initialScore += indexRouteValue;
	return segments.filter((s) => !isSplat(s)).reduce((score, segment) => score + (paramRe.test(segment) ? dynamicSegmentValue : segment === "" ? emptySegmentValue : staticSegmentValue), initialScore);
}
function compareIndexes(a, b$1) {
	return a.length === b$1.length && a.slice(0, -1).every((n$2, i) => n$2 === b$1[i]) ? a[a.length - 1] - b$1[b$1.length - 1] : 0;
}
function matchRouteBranch(branch, pathname, allowPartial = false) {
	let { routesMeta } = branch;
	let matchedParams = {};
	let matchedPathname = "/";
	let matches = [];
	for (let i = 0; i < routesMeta.length; ++i) {
		let meta = routesMeta[i];
		let end = i === routesMeta.length - 1;
		let remainingPathname = matchedPathname === "/" ? pathname : pathname.slice(matchedPathname.length) || "/";
		let pattern = {
			path: meta.relativePath,
			caseSensitive: meta.caseSensitive,
			end
		};
		let match = meta.matcher && meta.compiledParams ? matchPathImpl(pattern, remainingPathname, meta.matcher, meta.compiledParams) : matchPath(pattern, remainingPathname);
		let route = meta.route;
		if (!match && end && allowPartial && !routesMeta[routesMeta.length - 1].route.index) match = matchPath({
			path: meta.relativePath,
			caseSensitive: meta.caseSensitive,
			end: false
		}, remainingPathname);
		if (!match) return null;
		Object.assign(matchedParams, match.params);
		matches.push({
			params: matchedParams,
			pathname: joinPaths([matchedPathname, match.pathname]),
			pathnameBase: normalizePathname(joinPaths([matchedPathname, match.pathnameBase])),
			route
		});
		if (match.pathnameBase !== "/") matchedPathname = joinPaths([matchedPathname, match.pathnameBase]);
	}
	return matches;
}
function matchPath(pattern, pathname) {
	if (typeof pattern === "string") pattern = {
		path: pattern,
		caseSensitive: false,
		end: true
	};
	let [matcher, compiledParams] = compilePath(pattern.path, pattern.caseSensitive, pattern.end);
	return matchPathImpl(pattern, pathname, matcher, compiledParams);
}
function matchPathImpl(pattern, pathname, matcher, compiledParams) {
	let match = pathname.match(matcher);
	if (!match) return null;
	let matchedPathname = match[0];
	let pathnameBase = matchedPathname.replace(/(.)\/+$/, "$1");
	let captureGroups = match.slice(1);
	return {
		params: compiledParams.reduce((memo2, { paramName, isOptional }, index$1) => {
			if (paramName === "*") {
				let splatValue = captureGroups[index$1] || "";
				pathnameBase = matchedPathname.slice(0, matchedPathname.length - splatValue.length).replace(/(.)\/+$/, "$1");
			}
			const value = captureGroups[index$1];
			if (isOptional && !value) memo2[paramName] = void 0;
			else memo2[paramName] = (value || "").replace(/%2F/g, "/");
			return memo2;
		}, {}),
		pathname: matchedPathname,
		pathnameBase,
		pattern
	};
}
function compilePath(path, caseSensitive = false, end = true) {
	warning(path === "*" || !path.endsWith("*") || path.endsWith("/*"), `Route path "${path}" will be treated as if it were "${path.replace(/\*$/, "/*")}" because the \`*\` character must always follow a \`/\` in the pattern. To get rid of this warning, please change the route path to "${path.replace(/\*$/, "/*")}".`);
	let params = [];
	let regexpSource = "^" + path.replace(/\/*\*?$/, "").replace(/^\/*/, "/").replace(/[\\.*+^${}|()[\]]/g, "\\$&").replace(/\/:([\w-]+)(\?)?/g, (match, paramName, isOptional, index$1, str) => {
		params.push({
			paramName,
			isOptional: isOptional != null
		});
		if (isOptional) {
			let nextChar = str.charAt(index$1 + match.length);
			if (nextChar && nextChar !== "/") return "/([^\\/]*)";
			return "(?:/([^\\/]*))?";
		}
		return "/([^\\/]+)";
	}).replace(/\/([\w-]+)\?(\/|$)/g, "(/$1)?$2");
	if (path.endsWith("*")) {
		params.push({ paramName: "*" });
		regexpSource += path === "*" || path === "/*" ? "(.*)$" : "(?:\\/(.+)|\\/*)$";
	} else if (end) regexpSource += "\\/*$";
	else if (path !== "" && path !== "/") regexpSource += "(?:(?=\\/|$))";
	return [new RegExp(regexpSource, caseSensitive ? void 0 : "i"), params];
}
function decodePath(value) {
	try {
		return value.split("/").map((v$3) => decodeURIComponent(v$3).replace(/\//g, "%2F")).join("/");
	} catch (error$1) {
		warning(false, `The URL path "${value}" could not be decoded because it is a malformed URL segment. This is probably due to a bad percent encoding (${error$1}).`);
		return value;
	}
}
function stripBasename(pathname, basename) {
	if (basename === "/") return pathname;
	if (!pathname.toLowerCase().startsWith(basename.toLowerCase())) return null;
	let startIndex = basename.endsWith("/") ? basename.length - 1 : basename.length;
	let nextChar = pathname.charAt(startIndex);
	if (nextChar && nextChar !== "/") return null;
	return pathname.slice(startIndex) || "/";
}
function resolvePath(to, fromPathname = "/") {
	let { pathname: toPathname, search = "", hash = "" } = typeof to === "string" ? parsePath(to) : to;
	let pathname;
	if (toPathname) {
		toPathname = removeDoubleSlashes(toPathname);
		if (toPathname.startsWith("/")) pathname = resolvePathname(toPathname.substring(1), "/");
		else pathname = resolvePathname(toPathname, fromPathname);
	} else pathname = fromPathname;
	return {
		pathname,
		search: normalizeSearch(search),
		hash: normalizeHash(hash)
	};
}
function resolvePathname(relativePath, fromPathname) {
	let segments = removeTrailingSlash(fromPathname).split("/");
	relativePath.split("/").forEach((segment) => {
		if (segment === "..") {
			if (segments.length > 1) segments.pop();
		} else if (segment !== ".") segments.push(segment);
	});
	return segments.length > 1 ? segments.join("/") : "/";
}
function getInvalidPathError(char, field, dest, path) {
	return `Cannot include a '${char}' character in a manually specified \`to.${field}\` field [${JSON.stringify(path)}].  Please separate it out to the \`to.${dest}\` field. Alternatively you may provide the full path as a string in <Link to="..."> and the router will parse it for you.`;
}
function getPathContributingMatches(matches) {
	return matches.filter((match, index$1) => index$1 === 0 || match.route.path && match.route.path.length > 0);
}
function getResolveToMatches(matches) {
	let pathMatches = getPathContributingMatches(matches);
	return pathMatches.map((match, idx) => idx === pathMatches.length - 1 ? match.pathname : match.pathnameBase);
}
function resolveTo(toArg, routePathnames, locationPathname, isPathRelative = false) {
	let to;
	if (typeof toArg === "string") to = parsePath(toArg);
	else {
		to = { ...toArg };
		invariant$2(!to.pathname || !to.pathname.includes("?"), getInvalidPathError("?", "pathname", "search", to));
		invariant$2(!to.pathname || !to.pathname.includes("#"), getInvalidPathError("#", "pathname", "hash", to));
		invariant$2(!to.search || !to.search.includes("#"), getInvalidPathError("#", "search", "hash", to));
	}
	let isEmptyPath = toArg === "" || to.pathname === "";
	let toPathname = isEmptyPath ? "/" : to.pathname;
	let from;
	if (toPathname == null) from = locationPathname;
	else {
		let routePathnameIndex = routePathnames.length - 1;
		if (!isPathRelative && toPathname.startsWith("..")) {
			let toSegments = toPathname.split("/");
			while (toSegments[0] === "..") {
				toSegments.shift();
				routePathnameIndex -= 1;
			}
			to.pathname = toSegments.join("/");
		}
		from = routePathnameIndex >= 0 ? routePathnames[routePathnameIndex] : "/";
	}
	let path = resolvePath(to, from);
	let hasExplicitTrailingSlash = toPathname && toPathname !== "/" && toPathname.endsWith("/");
	let hasCurrentTrailingSlash = (isEmptyPath || toPathname === ".") && locationPathname.endsWith("/");
	if (!path.pathname.endsWith("/") && (hasExplicitTrailingSlash || hasCurrentTrailingSlash)) path.pathname += "/";
	return path;
}
var removeDoubleSlashes = (path) => path.replace(/[\\/]{2,}/g, "/");
var joinPaths = (paths) => removeDoubleSlashes(paths.join("/"));
var removeTrailingSlash = (path) => path.replace(/\/+$/, "");
var normalizePathname = (pathname) => removeTrailingSlash(pathname).replace(/^\/*/, "/");
var normalizeSearch = (search) => !search || search === "?" ? "" : search.startsWith("?") ? search : "?" + search;
var normalizeHash = (hash) => !hash || hash === "#" ? "" : hash.startsWith("#") ? hash : "#" + hash;
var ErrorResponseImpl = class {
	constructor(status, statusText, data2, internal = false) {
		this.status = status;
		this.statusText = statusText || "";
		this.internal = internal;
		if (data2 instanceof Error) {
			this.data = data2.toString();
			this.error = data2;
		} else this.data = data2;
	}
};
function isRouteErrorResponse(error$1) {
	return error$1 != null && typeof error$1.status === "number" && typeof error$1.statusText === "string" && typeof error$1.internal === "boolean" && "data" in error$1;
}
function getRoutePattern(matches) {
	return joinPaths(matches.map((m$2) => m$2.route.path).filter(Boolean)) || "/";
}
var isBrowser = typeof window !== "undefined" && typeof window.document !== "undefined" && typeof window.document.createElement !== "undefined";
function parseToInfo(_to, basename) {
	let to = _to;
	if (typeof to !== "string" || !ABSOLUTE_URL_REGEX.test(to)) return {
		absoluteURL: void 0,
		isExternal: false,
		to
	};
	let absoluteURL = to;
	let isExternal = false;
	if (isBrowser) try {
		let currentUrl = new URL(window.location.href);
		let targetUrl = PROTOCOL_RELATIVE_URL_REGEX.test(to) ? new URL(normalizeProtocolRelativeUrl(to, currentUrl.protocol)) : new URL(to);
		let path = stripBasename(targetUrl.pathname, basename);
		if (targetUrl.origin === currentUrl.origin && path != null) to = path + targetUrl.search + targetUrl.hash;
		else isExternal = true;
	} catch (e) {
		warning(false, `<Link to="${to}"> contains an invalid URL which will probably break when clicked - please update to a valid URL path.`);
	}
	return {
		absoluteURL,
		isExternal,
		to
	};
}
Object.getOwnPropertyNames(Object.prototype).sort().join("\0");
var invalidProtocols = [
	"about:",
	"blob:",
	"chrome:",
	"chrome-untrusted:",
	"content:",
	"data:",
	"devtools:",
	"file:",
	"filesystem:",
	"javascript:"
];
function hasInvalidProtocol(location) {
	try {
		return invalidProtocols.includes(new URL(location).protocol);
	} catch {
		return false;
	}
}
var DataRouterContext = import_react.createContext(null);
DataRouterContext.displayName = "DataRouter";
var DataRouterStateContext = import_react.createContext(null);
DataRouterStateContext.displayName = "DataRouterState";
var RSCRouterContext = import_react.createContext(false);
function useIsRSCRouterContext() {
	return import_react.useContext(RSCRouterContext);
}
var ViewTransitionContext = import_react.createContext({ isTransitioning: false });
ViewTransitionContext.displayName = "ViewTransition";
var FetchersContext = import_react.createContext(/* @__PURE__ */ new Map());
FetchersContext.displayName = "Fetchers";
var AwaitContext = import_react.createContext(null);
AwaitContext.displayName = "Await";
var NavigationContext = import_react.createContext(null);
NavigationContext.displayName = "Navigation";
var LocationContext = import_react.createContext(null);
LocationContext.displayName = "Location";
var RouteContext = import_react.createContext({
	outlet: null,
	matches: [],
	isDataRoute: false
});
RouteContext.displayName = "Route";
var RouteErrorContext = import_react.createContext(null);
RouteErrorContext.displayName = "RouteError";
var ERROR_DIGEST_BASE = "REACT_ROUTER_ERROR";
var ERROR_DIGEST_REDIRECT = "REDIRECT";
var ERROR_DIGEST_ROUTE_ERROR_RESPONSE = "ROUTE_ERROR_RESPONSE";
function decodeRedirectErrorDigest(digest) {
	if (digest.startsWith(`${ERROR_DIGEST_BASE}:${ERROR_DIGEST_REDIRECT}:{`)) try {
		let parsed = JSON.parse(digest.slice(28));
		if (typeof parsed === "object" && parsed && typeof parsed.status === "number" && typeof parsed.statusText === "string" && typeof parsed.location === "string" && typeof parsed.reloadDocument === "boolean" && typeof parsed.replace === "boolean") return parsed;
	} catch {}
}
function decodeRouteErrorResponseDigest(digest) {
	if (digest.startsWith(`${ERROR_DIGEST_BASE}:${ERROR_DIGEST_ROUTE_ERROR_RESPONSE}:{`)) try {
		let parsed = JSON.parse(digest.slice(40));
		if (typeof parsed === "object" && parsed && typeof parsed.status === "number" && typeof parsed.statusText === "string") return new ErrorResponseImpl(parsed.status, parsed.statusText, parsed.data);
	} catch {}
}
function useHref(to, { relative } = {}) {
	invariant$2(useInRouterContext(), `useHref() may be used only in the context of a <Router> component.`);
	let { basename, navigator: navigator$1 } = import_react.useContext(NavigationContext);
	let { hash, pathname, search } = useResolvedPath(to, { relative });
	let joinedPathname = pathname;
	if (basename !== "/") joinedPathname = pathname === "/" ? basename : joinPaths([basename, pathname]);
	return navigator$1.createHref({
		pathname: joinedPathname,
		search,
		hash
	});
}
function useInRouterContext() {
	return import_react.useContext(LocationContext) != null;
}
function useLocation() {
	invariant$2(useInRouterContext(), `useLocation() may be used only in the context of a <Router> component.`);
	return import_react.useContext(LocationContext).location;
}
var navigateEffectWarning = `You should call navigate() in a React.useEffect(), not when your component is first rendered.`;
function useIsomorphicLayoutEffect(cb$1) {
	if (!import_react.useContext(NavigationContext).static) import_react.useLayoutEffect(cb$1);
}
function useNavigate() {
	let { isDataRoute } = import_react.useContext(RouteContext);
	return isDataRoute ? useNavigateStable() : useNavigateUnstable();
}
function useNavigateUnstable() {
	invariant$2(useInRouterContext(), `useNavigate() may be used only in the context of a <Router> component.`);
	let dataRouterContext = import_react.useContext(DataRouterContext);
	let { basename, navigator: navigator$1 } = import_react.useContext(NavigationContext);
	let { matches } = import_react.useContext(RouteContext);
	let { pathname: locationPathname } = useLocation();
	let routePathnamesJson = JSON.stringify(getResolveToMatches(matches));
	let activeRef = import_react.useRef(false);
	useIsomorphicLayoutEffect(() => {
		activeRef.current = true;
	});
	return import_react.useCallback((to, options = {}) => {
		warning(activeRef.current, navigateEffectWarning);
		if (!activeRef.current) return;
		if (typeof to === "number") {
			navigator$1.go(to);
			return;
		}
		let path = resolveTo(to, JSON.parse(routePathnamesJson), locationPathname, options.relative === "path");
		if (dataRouterContext == null && basename !== "/") path.pathname = path.pathname === "/" ? basename : joinPaths([basename, path.pathname]);
		(!!options.replace ? navigator$1.replace : navigator$1.push)(path, options.state, options);
	}, [
		basename,
		navigator$1,
		routePathnamesJson,
		locationPathname,
		dataRouterContext
	]);
}
import_react.createContext(null);
function useResolvedPath(to, { relative } = {}) {
	let { matches } = import_react.useContext(RouteContext);
	let { pathname: locationPathname } = useLocation();
	let routePathnamesJson = JSON.stringify(getResolveToMatches(matches));
	return import_react.useMemo(() => resolveTo(to, JSON.parse(routePathnamesJson), locationPathname, relative === "path"), [
		to,
		routePathnamesJson,
		locationPathname,
		relative
	]);
}
function useRoutes(routes$1, locationArg) {
	return useRoutesImpl(routes$1, locationArg);
}
function useRoutesImpl(routes$1, locationArg, dataRouterOpts) {
	invariant$2(useInRouterContext(), `useRoutes() may be used only in the context of a <Router> component.`);
	let { navigator: navigator$1 } = import_react.useContext(NavigationContext);
	let { matches: parentMatches } = import_react.useContext(RouteContext);
	let routeMatch = parentMatches[parentMatches.length - 1];
	let parentParams = routeMatch ? routeMatch.params : {};
	let parentPathname = routeMatch ? routeMatch.pathname : "/";
	let parentPathnameBase = routeMatch ? routeMatch.pathnameBase : "/";
	let parentRoute = routeMatch && routeMatch.route;
	{
		let parentPath = parentRoute && parentRoute.path || "";
		warningOnce(parentPathname, !parentRoute || parentPath.endsWith("*") || parentPath.endsWith("*?"), `You rendered descendant <Routes> (or called \`useRoutes()\`) at "${parentPathname}" (under <Route path="${parentPath}">) but the parent route path has no trailing "*". This means if you navigate deeper, the parent won't match anymore and therefore the child routes will never render.

Please change the parent <Route path="${parentPath}"> to <Route path="${parentPath === "/" ? "*" : `${parentPath}/*`}">.`);
	}
	let locationFromContext = useLocation();
	let location;
	if (locationArg) {
		let parsedLocationArg = typeof locationArg === "string" ? parsePath(locationArg) : locationArg;
		invariant$2(parentPathnameBase === "/" || parsedLocationArg.pathname?.startsWith(parentPathnameBase), `When overriding the location using \`<Routes location>\` or \`useRoutes(routes, location)\`, the location pathname must begin with the portion of the URL pathname that was matched by all parent routes. The current pathname base is "${parentPathnameBase}" but pathname "${parsedLocationArg.pathname}" was given in the \`location\` prop.`);
		location = parsedLocationArg;
	} else location = locationFromContext;
	let pathname = location.pathname || "/";
	let remainingPathname = pathname;
	if (parentPathnameBase !== "/") {
		let parentSegments = parentPathnameBase.replace(/^\//, "").split("/");
		remainingPathname = "/" + pathname.replace(/^\//, "").split("/").slice(parentSegments.length).join("/");
	}
	let matches = dataRouterOpts && dataRouterOpts.state.matches.length ? dataRouterOpts.state.matches.map((m$2) => Object.assign(m$2, { route: dataRouterOpts.manifest[m$2.route.id] || m$2.route })) : matchRoutes(routes$1, { pathname: remainingPathname });
	warning(parentRoute || matches != null, `No routes matched location "${location.pathname}${location.search}${location.hash}" `);
	warning(matches == null || matches[matches.length - 1].route.element !== void 0 || matches[matches.length - 1].route.Component !== void 0 || matches[matches.length - 1].route.lazy !== void 0, `Matched leaf route at location "${location.pathname}${location.search}${location.hash}" does not have an element or Component. This means it will render an <Outlet /> with a null value by default resulting in an "empty" page.`);
	let renderedMatches = _renderMatches(matches && matches.map((match) => Object.assign({}, match, {
		params: Object.assign({}, parentParams, match.params),
		pathname: joinPaths([parentPathnameBase, navigator$1.encodeLocation ? navigator$1.encodeLocation(match.pathname.replace(/%/g, "%25").replace(/\?/g, "%3F").replace(/#/g, "%23")).pathname : match.pathname]),
		pathnameBase: match.pathnameBase === "/" ? parentPathnameBase : joinPaths([parentPathnameBase, navigator$1.encodeLocation ? navigator$1.encodeLocation(match.pathnameBase.replace(/%/g, "%25").replace(/\?/g, "%3F").replace(/#/g, "%23")).pathname : match.pathnameBase])
	})), parentMatches, dataRouterOpts);
	if (locationArg && renderedMatches) return /* @__PURE__ */ import_react.createElement(LocationContext.Provider, { value: {
		location: {
			pathname: "/",
			search: "",
			hash: "",
			state: null,
			key: "default",
			mask: void 0,
			...location
		},
		navigationType: "POP"
	} }, renderedMatches);
	return renderedMatches;
}
function DefaultErrorComponent() {
	let error$1 = useRouteError();
	let message = isRouteErrorResponse(error$1) ? `${error$1.status} ${error$1.statusText}` : error$1 instanceof Error ? error$1.message : JSON.stringify(error$1);
	let stack = error$1 instanceof Error ? error$1.stack : null;
	let lightgrey = "rgba(200,200,200, 0.5)";
	let preStyles = {
		padding: "0.5rem",
		backgroundColor: lightgrey
	};
	let codeStyles = {
		padding: "2px 4px",
		backgroundColor: lightgrey
	};
	let devInfo = null;
	console.error("Error handled by React Router default ErrorBoundary:", error$1);
	devInfo = /* @__PURE__ */ import_react.createElement(import_react.Fragment, null, /* @__PURE__ */ import_react.createElement("p", null, "💿 Hey developer 👋"), /* @__PURE__ */ import_react.createElement("p", null, "You can provide a way better UX than this when your app throws errors by providing your own ", /* @__PURE__ */ import_react.createElement("code", { style: codeStyles }, "ErrorBoundary"), " or", " ", /* @__PURE__ */ import_react.createElement("code", { style: codeStyles }, "errorElement"), " prop on your route."));
	return /* @__PURE__ */ import_react.createElement(import_react.Fragment, null, /* @__PURE__ */ import_react.createElement("h2", null, "Unexpected Application Error!"), /* @__PURE__ */ import_react.createElement("h3", { style: { fontStyle: "italic" } }, message), stack ? /* @__PURE__ */ import_react.createElement("pre", { style: preStyles }, stack) : null, devInfo);
}
var defaultErrorElement = /* @__PURE__ */ import_react.createElement(DefaultErrorComponent, null);
var RenderErrorBoundary = class extends import_react.Component {
	constructor(props) {
		super(props);
		this.state = {
			location: props.location,
			revalidation: props.revalidation,
			error: props.error
		};
	}
	static getDerivedStateFromError(error$1) {
		return { error: error$1 };
	}
	static getDerivedStateFromProps(props, state) {
		if (state.location !== props.location || state.revalidation !== "idle" && props.revalidation === "idle") return {
			error: props.error,
			location: props.location,
			revalidation: props.revalidation
		};
		return {
			error: props.error !== void 0 ? props.error : state.error,
			location: state.location,
			revalidation: props.revalidation || state.revalidation
		};
	}
	componentDidCatch(error$1, errorInfo) {
		if (this.props.onError) this.props.onError(error$1, errorInfo);
		else console.error("React Router caught the following error during render", error$1);
	}
	render() {
		let error$1 = this.state.error;
		if (this.context && typeof error$1 === "object" && error$1 && "digest" in error$1 && typeof error$1.digest === "string") {
			const decoded = decodeRouteErrorResponseDigest(error$1.digest);
			if (decoded) error$1 = decoded;
		}
		let result = error$1 !== void 0 ? /* @__PURE__ */ import_react.createElement(RouteContext.Provider, { value: this.props.routeContext }, /* @__PURE__ */ import_react.createElement(RouteErrorContext.Provider, {
			value: error$1,
			children: this.props.component
		})) : this.props.children;
		if (this.context) return /* @__PURE__ */ import_react.createElement(RSCErrorHandler, { error: error$1 }, result);
		return result;
	}
};
RenderErrorBoundary.contextType = RSCRouterContext;
var errorRedirectHandledMap = /* @__PURE__ */ new WeakMap();
function RSCErrorHandler({ children, error: error$1 }) {
	let { basename } = import_react.useContext(NavigationContext);
	if (typeof error$1 === "object" && error$1 && "digest" in error$1 && typeof error$1.digest === "string") {
		let redirect2 = decodeRedirectErrorDigest(error$1.digest);
		if (redirect2) {
			let existingRedirect = errorRedirectHandledMap.get(error$1);
			if (existingRedirect) throw existingRedirect;
			let parsed = parseToInfo(redirect2.location, basename);
			let target = parsed.absoluteURL || parsed.to;
			if (hasInvalidProtocol(target)) throw new Error("Invalid redirect location");
			if (isBrowser && !errorRedirectHandledMap.get(error$1)) if (parsed.isExternal || redirect2.reloadDocument) window.location.href = target;
			else {
				const redirectPromise = Promise.resolve().then(() => window.__reactRouterDataRouter.navigate(parsed.to, { replace: redirect2.replace }));
				errorRedirectHandledMap.set(error$1, redirectPromise);
				throw redirectPromise;
			}
			return /* @__PURE__ */ import_react.createElement("meta", {
				httpEquiv: "refresh",
				content: `0;url=${target}`
			});
		}
	}
	return children;
}
function RenderedRoute({ routeContext, match, children }) {
	let dataRouterContext = import_react.useContext(DataRouterContext);
	if (dataRouterContext && dataRouterContext.static && dataRouterContext.staticContext && (match.route.errorElement || match.route.ErrorBoundary)) dataRouterContext.staticContext._deepestRenderedBoundaryId = match.route.id;
	return /* @__PURE__ */ import_react.createElement(RouteContext.Provider, { value: routeContext }, children);
}
function _renderMatches(matches, parentMatches = [], dataRouterOpts) {
	let dataRouterState = dataRouterOpts?.state;
	if (matches == null) {
		if (!dataRouterState) return null;
		if (dataRouterState.errors) matches = dataRouterState.matches;
		else if (parentMatches.length === 0 && !dataRouterState.initialized && dataRouterState.matches.length > 0) matches = dataRouterState.matches;
		else return null;
	}
	let renderedMatches = matches;
	let errors = dataRouterState?.errors;
	if (errors != null) {
		let errorIndex = renderedMatches.findIndex((m$2) => m$2.route.id && errors?.[m$2.route.id] !== void 0);
		invariant$2(errorIndex >= 0, `Could not find a matching route for errors on route IDs: ${Object.keys(errors).join(",")}`);
		renderedMatches = renderedMatches.slice(0, Math.min(renderedMatches.length, errorIndex + 1));
	}
	let renderFallback = false;
	let fallbackIndex = -1;
	if (dataRouterOpts && dataRouterState) {
		renderFallback = dataRouterState.renderFallback;
		for (let i = 0; i < renderedMatches.length; i++) {
			let match = renderedMatches[i];
			if (match.route.HydrateFallback || match.route.hydrateFallbackElement) fallbackIndex = i;
			if (match.route.id) {
				let { loaderData, errors: errors2 } = dataRouterState;
				let needsToRunLoader = match.route.loader && !loaderData.hasOwnProperty(match.route.id) && (!errors2 || errors2[match.route.id] === void 0);
				if (match.route.lazy || needsToRunLoader) {
					if (dataRouterOpts.isStatic) renderFallback = true;
					if (fallbackIndex >= 0) renderedMatches = renderedMatches.slice(0, fallbackIndex + 1);
					else renderedMatches = [renderedMatches[0]];
					break;
				}
			}
		}
	}
	let onErrorHandler = dataRouterOpts?.onError;
	let onError = dataRouterState && onErrorHandler ? (error$1, errorInfo) => {
		onErrorHandler(error$1, {
			location: dataRouterState.location,
			params: dataRouterState.matches?.[0]?.params ?? {},
			pattern: getRoutePattern(dataRouterState.matches),
			errorInfo
		});
	} : void 0;
	return renderedMatches.reduceRight((outlet, match, index$1) => {
		let error$1;
		let shouldRenderHydrateFallback = false;
		let errorElement = null;
		let hydrateFallbackElement = null;
		if (dataRouterState) {
			error$1 = errors && match.route.id ? errors[match.route.id] : void 0;
			errorElement = match.route.errorElement || defaultErrorElement;
			if (renderFallback) {
				if (fallbackIndex < 0 && index$1 === 0) {
					warningOnce("route-fallback", false, "No `HydrateFallback` element provided to render during initial hydration");
					shouldRenderHydrateFallback = true;
					hydrateFallbackElement = null;
				} else if (fallbackIndex === index$1) {
					shouldRenderHydrateFallback = true;
					hydrateFallbackElement = match.route.hydrateFallbackElement || null;
				}
			}
		}
		let matches2 = parentMatches.concat(renderedMatches.slice(0, index$1 + 1));
		let getChildren = () => {
			let children;
			if (error$1) children = errorElement;
			else if (shouldRenderHydrateFallback) children = hydrateFallbackElement;
			else if (match.route.Component) children = /* @__PURE__ */ import_react.createElement(match.route.Component, null);
			else if (match.route.element) children = match.route.element;
			else children = outlet;
			return /* @__PURE__ */ import_react.createElement(RenderedRoute, {
				match,
				routeContext: {
					outlet,
					matches: matches2,
					isDataRoute: dataRouterState != null
				},
				children
			});
		};
		return dataRouterState && (match.route.ErrorBoundary || match.route.errorElement || index$1 === 0) ? /* @__PURE__ */ import_react.createElement(RenderErrorBoundary, {
			location: dataRouterState.location,
			revalidation: dataRouterState.revalidation,
			component: errorElement,
			error: error$1,
			children: getChildren(),
			routeContext: {
				outlet: null,
				matches: matches2,
				isDataRoute: true
			},
			onError
		}) : getChildren();
	}, null);
}
function getDataRouterConsoleError(hookName) {
	return `${hookName} must be used within a data router.  See https://reactrouter.com/en/main/routers/picking-a-router.`;
}
function useDataRouterContext(hookName) {
	let ctx = import_react.useContext(DataRouterContext);
	invariant$2(ctx, getDataRouterConsoleError(hookName));
	return ctx;
}
function useDataRouterState(hookName) {
	let state = import_react.useContext(DataRouterStateContext);
	invariant$2(state, getDataRouterConsoleError(hookName));
	return state;
}
function useRouteContext(hookName) {
	let route = import_react.useContext(RouteContext);
	invariant$2(route, getDataRouterConsoleError(hookName));
	return route;
}
function useCurrentRouteId(hookName) {
	let route = useRouteContext(hookName);
	let thisRoute = route.matches[route.matches.length - 1];
	invariant$2(thisRoute.route.id, `${hookName} can only be used on routes that contain a unique "id"`);
	return thisRoute.route.id;
}
function useRouteId() {
	return useCurrentRouteId("useRouteId");
}
function useNavigation() {
	let state = useDataRouterState("useNavigation");
	return import_react.useMemo(() => {
		let { matches, historyAction, ...rest } = state.navigation;
		return rest;
	}, [state.navigation]);
}
function useMatches() {
	let { matches, loaderData } = useDataRouterState("useMatches");
	return import_react.useMemo(() => matches.map((m$2) => convertRouteMatchToUiMatch(m$2, loaderData)), [matches, loaderData]);
}
function useRouteError() {
	let error$1 = import_react.useContext(RouteErrorContext);
	let state = useDataRouterState("useRouteError");
	let routeId = useCurrentRouteId("useRouteError");
	if (error$1 !== void 0) return error$1;
	return state.errors?.[routeId];
}
function useNavigateStable() {
	let { router } = useDataRouterContext("useNavigate");
	let id$1 = useCurrentRouteId("useNavigate");
	let activeRef = import_react.useRef(false);
	useIsomorphicLayoutEffect(() => {
		activeRef.current = true;
	});
	return import_react.useCallback(async (to, options = {}) => {
		warning(activeRef.current, navigateEffectWarning);
		if (!activeRef.current) return;
		if (typeof to === "number") await router.navigate(to);
		else await router.navigate(to, {
			fromRouteId: id$1,
			...options
		});
	}, [router, id$1]);
}
var alreadyWarned = {};
function warningOnce(key, cond, message) {
	if (!cond && !alreadyWarned[key]) {
		alreadyWarned[key] = true;
		warning(false, message);
	}
}
import_react["useOptimistic"];
import_react.memo(DataRoutes2);
function DataRoutes2({ routes: routes$1, manifest, future, state, isStatic, onError }) {
	return useRoutesImpl(routes$1, void 0, {
		manifest,
		state,
		isStatic,
		onError,
		future
	});
}
function Navigate({ to, replace: replace2, state, relative }) {
	invariant$2(useInRouterContext(), `<Navigate> may be used only in the context of a <Router> component.`);
	let { static: isStatic } = import_react.useContext(NavigationContext);
	warning(!isStatic, `<Navigate> must not be used on the initial render in a <StaticRouter>. This is a no-op, but you should modify your code so the <Navigate> is only ever rendered in response to some user interaction or state change.`);
	let { matches } = import_react.useContext(RouteContext);
	let { pathname: locationPathname } = useLocation();
	let navigate = useNavigate();
	let path = resolveTo(to, getResolveToMatches(matches), locationPathname, relative === "path");
	let jsonPath = JSON.stringify(path);
	import_react.useEffect(() => {
		navigate(JSON.parse(jsonPath), {
			replace: replace2,
			state,
			relative
		});
	}, [
		navigate,
		jsonPath,
		relative,
		replace2,
		state
	]);
	return null;
}
function Route(props) {
	invariant$2(false, `A <Route> is only ever to be used as the child of <Routes> element, never rendered directly. Please wrap your <Route> in a <Routes>.`);
}
function Router({ basename: basenameProp = "/", children = null, location: locationProp, navigationType = "POP", navigator: navigator$1, static: staticProp = false, useTransitions }) {
	invariant$2(!useInRouterContext(), `You cannot render a <Router> inside another <Router>. You should never have more than one in your app.`);
	let basename = basenameProp.replace(/^\/*/, "/");
	let navigationContext = import_react.useMemo(() => ({
		basename,
		navigator: navigator$1,
		static: staticProp,
		useTransitions,
		future: {}
	}), [
		basename,
		navigator$1,
		staticProp,
		useTransitions
	]);
	if (typeof locationProp === "string") locationProp = parsePath(locationProp);
	let { pathname = "/", search = "", hash = "", state = null, key = "default", mask } = locationProp;
	let locationContext = import_react.useMemo(() => {
		let trailingPathname = stripBasename(pathname, basename);
		if (trailingPathname == null) return null;
		return {
			location: {
				pathname: trailingPathname,
				search,
				hash,
				state,
				key,
				mask
			},
			navigationType
		};
	}, [
		basename,
		pathname,
		search,
		hash,
		state,
		key,
		navigationType,
		mask
	]);
	warning(locationContext != null, `<Router basename="${basename}"> is not able to match the URL "${pathname}${search}${hash}" because it does not start with the basename, so the <Router> won't render anything.`);
	if (locationContext == null) return null;
	return /* @__PURE__ */ import_react.createElement(NavigationContext.Provider, { value: navigationContext }, /* @__PURE__ */ import_react.createElement(LocationContext.Provider, {
		children,
		value: locationContext
	}));
}
function Routes({ children, location }) {
	return useRoutes(createRoutesFromChildren(children), location);
}
function createRoutesFromChildren(children, parentPath = []) {
	let routes$1 = [];
	import_react.Children.forEach(children, (element, index$1) => {
		if (!import_react.isValidElement(element)) return;
		let treePath = [...parentPath, index$1];
		if (element.type === import_react.Fragment) {
			routes$1.push.apply(routes$1, createRoutesFromChildren(element.props.children, treePath));
			return;
		}
		invariant$2(element.type === Route, `[${typeof element.type === "string" ? element.type : element.type.name}] is not a <Route> component. All component children of <Routes> must be a <Route> or <React.Fragment>`);
		invariant$2(!element.props.index || !element.props.children, "An index route cannot have child routes.");
		let route = {
			id: element.props.id || treePath.join("-"),
			caseSensitive: element.props.caseSensitive,
			element: element.props.element,
			Component: element.props.Component,
			index: element.props.index,
			path: element.props.path,
			middleware: element.props.middleware,
			loader: element.props.loader,
			action: element.props.action,
			hydrateFallbackElement: element.props.hydrateFallbackElement,
			HydrateFallback: element.props.HydrateFallback,
			errorElement: element.props.errorElement,
			ErrorBoundary: element.props.ErrorBoundary,
			hasErrorBoundary: element.props.hasErrorBoundary === true || element.props.ErrorBoundary != null || element.props.errorElement != null,
			shouldRevalidate: element.props.shouldRevalidate,
			handle: element.props.handle,
			lazy: element.props.lazy
		};
		if (element.props.children) route.children = createRoutesFromChildren(element.props.children, treePath);
		routes$1.push(route);
	});
	return routes$1;
}
var defaultMethod = "get";
var defaultEncType = "application/x-www-form-urlencoded";
function isHtmlElement(object) {
	return typeof HTMLElement !== "undefined" && object instanceof HTMLElement;
}
function isButtonElement(object) {
	return isHtmlElement(object) && object.tagName.toLowerCase() === "button";
}
function isFormElement(object) {
	return isHtmlElement(object) && object.tagName.toLowerCase() === "form";
}
function isInputElement(object) {
	return isHtmlElement(object) && object.tagName.toLowerCase() === "input";
}
function isModifiedEvent(event) {
	return !!(event.metaKey || event.altKey || event.ctrlKey || event.shiftKey);
}
function shouldProcessLinkClick(event, target) {
	return event.button === 0 && (!target || target === "_self") && !isModifiedEvent(event);
}
var _formDataSupportsSubmitter = null;
function isFormDataSubmitterSupported() {
	if (_formDataSupportsSubmitter === null) try {
		new FormData(document.createElement("form"), 0);
		_formDataSupportsSubmitter = false;
	} catch (e) {
		_formDataSupportsSubmitter = true;
	}
	return _formDataSupportsSubmitter;
}
var supportedFormEncTypes = /* @__PURE__ */ new Set([
	"application/x-www-form-urlencoded",
	"multipart/form-data",
	"text/plain"
]);
function getFormEncType(encType) {
	if (encType != null && !supportedFormEncTypes.has(encType)) {
		warning(false, `"${encType}" is not a valid \`encType\` for \`<Form>\`/\`<fetcher.Form>\` and will default to "${defaultEncType}"`);
		return null;
	}
	return encType;
}
function getFormSubmissionInfo(target, basename) {
	let method;
	let action;
	let encType;
	let formData;
	let body;
	if (isFormElement(target)) {
		let attr = target.getAttribute("action");
		action = attr ? stripBasename(attr, basename) : null;
		method = target.getAttribute("method") || defaultMethod;
		encType = getFormEncType(target.getAttribute("enctype")) || defaultEncType;
		formData = new FormData(target);
	} else if (isButtonElement(target) || isInputElement(target) && (target.type === "submit" || target.type === "image")) {
		let form = target.form;
		if (form == null) throw new Error(`Cannot submit a <button> or <input type="submit"> without a <form>`);
		let attr = target.getAttribute("formaction") || form.getAttribute("action");
		action = attr ? stripBasename(attr, basename) : null;
		method = target.getAttribute("formmethod") || form.getAttribute("method") || defaultMethod;
		encType = getFormEncType(target.getAttribute("formenctype")) || getFormEncType(form.getAttribute("enctype")) || defaultEncType;
		formData = new FormData(form, target);
		if (!isFormDataSubmitterSupported()) {
			let { name, type, value } = target;
			if (type === "image") {
				let prefix = name ? `${name}.` : "";
				formData.append(`${prefix}x`, "0");
				formData.append(`${prefix}y`, "0");
			} else if (name) formData.append(name, value);
		}
	} else if (isHtmlElement(target)) throw new Error(`Cannot submit element that is not <form>, <button>, or <input type="submit|image">`);
	else {
		method = defaultMethod;
		action = null;
		encType = defaultEncType;
		body = target;
	}
	if (formData && encType === "text/plain") {
		body = formData;
		formData = void 0;
	}
	return {
		action,
		method: method.toLowerCase(),
		encType,
		formData,
		body
	};
}
Object.getOwnPropertyNames(Object.prototype).sort().join("\0");
var ESCAPE_LOOKUP = {
	"&": "\\u0026",
	">": "\\u003e",
	"<": "\\u003c",
	"\u2028": "\\u2028",
	"\u2029": "\\u2029"
};
var ESCAPE_REGEX = /[&><\u2028\u2029]/g;
function escapeHtml(html) {
	return html.replace(ESCAPE_REGEX, (match) => ESCAPE_LOOKUP[match]);
}
function invariant2(value, message) {
	if (value === false || value === null || typeof value === "undefined") throw new Error(message);
}
function singleFetchUrl(reqUrl, basename, trailingSlashAware, extension) {
	let url = typeof reqUrl === "string" ? new URL(reqUrl, typeof window === "undefined" ? "server://singlefetch/" : window.location.origin) : reqUrl;
	if (trailingSlashAware) if (url.pathname.endsWith("/")) url.pathname = `${url.pathname}_.${extension}`;
	else url.pathname = `${url.pathname}.${extension}`;
	else if (url.pathname === "/") url.pathname = `_root.${extension}`;
	else if (basename && stripBasename(url.pathname, basename) === "/") url.pathname = `${removeTrailingSlash(basename)}/_root.${extension}`;
	else url.pathname = `${removeTrailingSlash(url.pathname)}.${extension}`;
	return url;
}
async function loadRouteModule(route, routeModulesCache) {
	if (route.id in routeModulesCache) return routeModulesCache[route.id];
	try {
		let routeModule = await __vitePreload(() => import(
			/* @vite-ignore */
			/* webpackIgnore: true */
			route.module
), []);
		routeModulesCache[route.id] = routeModule;
		return routeModule;
	} catch (error$1) {
		console.error(`Error loading route module \`${route.module}\`, reloading page...`);
		console.error(error$1);
		if (window.__reactRouterContext && window.__reactRouterContext.isSpaMode && void 0);
		window.location.reload();
		return new Promise(() => {});
	}
}
function isPageLinkDescriptor(object) {
	return object != null && typeof object.page === "string";
}
function isHtmlLinkDescriptor(object) {
	if (object == null) return false;
	if (object.href == null) return object.rel === "preload" && typeof object.imageSrcSet === "string" && typeof object.imageSizes === "string";
	return typeof object.rel === "string" && typeof object.href === "string";
}
async function getKeyedPrefetchLinks(matches, manifest, routeModules) {
	return dedupeLinkDescriptors((await Promise.all(matches.map(async (match) => {
		let route = manifest.routes[match.route.id];
		if (route) {
			let mod = await loadRouteModule(route, routeModules);
			return mod.links ? mod.links() : [];
		}
		return [];
	}))).flat(1).filter(isHtmlLinkDescriptor).filter((link) => link.rel === "stylesheet" || link.rel === "preload").map((link) => link.rel === "stylesheet" ? {
		...link,
		rel: "prefetch",
		as: "style"
	} : {
		...link,
		rel: "prefetch"
	}));
}
function getNewMatchesForLinks(page, nextMatches, currentMatches, manifest, location, mode) {
	let isNew = (match, index$1) => {
		if (!currentMatches[index$1]) return true;
		return match.route.id !== currentMatches[index$1].route.id;
	};
	let matchPathChanged = (match, index$1) => {
		return currentMatches[index$1].pathname !== match.pathname || currentMatches[index$1].route.path?.endsWith("*") && currentMatches[index$1].params["*"] !== match.params["*"];
	};
	if (mode === "assets") return nextMatches.filter((match, index$1) => isNew(match, index$1) || matchPathChanged(match, index$1));
	if (mode === "data") return nextMatches.filter((match, index$1) => {
		let manifestRoute = manifest.routes[match.route.id];
		if (!manifestRoute || !manifestRoute.hasLoader) return false;
		if (isNew(match, index$1) || matchPathChanged(match, index$1)) return true;
		if (match.route.shouldRevalidate) {
			let routeChoice = match.route.shouldRevalidate({
				currentUrl: new URL(location.pathname + location.search + location.hash, window.origin),
				currentParams: currentMatches[0]?.params || {},
				nextUrl: new URL(page, window.origin),
				nextParams: match.params,
				defaultShouldRevalidate: true
			});
			if (typeof routeChoice === "boolean") return routeChoice;
		}
		return true;
	});
	return [];
}
function getModuleLinkHrefs(matches, manifest, { includeHydrateFallback } = {}) {
	return dedupeHrefs(matches.map((match) => {
		let route = manifest.routes[match.route.id];
		if (!route) return [];
		let hrefs = [route.module];
		if (route.clientActionModule) hrefs = hrefs.concat(route.clientActionModule);
		if (route.clientLoaderModule) hrefs = hrefs.concat(route.clientLoaderModule);
		if (includeHydrateFallback && route.hydrateFallbackModule) hrefs = hrefs.concat(route.hydrateFallbackModule);
		if (route.imports) hrefs = hrefs.concat(route.imports);
		return hrefs;
	}).flat(1));
}
function dedupeHrefs(hrefs) {
	return [...new Set(hrefs)];
}
function sortKeys(obj) {
	let sorted = {};
	let keys = Object.keys(obj).sort();
	for (let key of keys) sorted[key] = obj[key];
	return sorted;
}
function dedupeLinkDescriptors(descriptors, preloads) {
	let set = /* @__PURE__ */ new Set();
	let preloadsSet = new Set(preloads);
	return descriptors.reduce((deduped, descriptor) => {
		if (preloads && !isPageLinkDescriptor(descriptor) && descriptor.as === "script" && descriptor.href && preloadsSet.has(descriptor.href)) return deduped;
		let key = JSON.stringify(sortKeys(descriptor));
		if (!set.has(key)) {
			set.add(key);
			deduped.push({
				key,
				link: descriptor
			});
		}
		return deduped;
	}, []);
}
function useDataRouterContext2() {
	let context = import_react.useContext(DataRouterContext);
	invariant2(context, "You must render this element inside a <DataRouterContext.Provider> element");
	return context;
}
function useDataRouterStateContext() {
	let context = import_react.useContext(DataRouterStateContext);
	invariant2(context, "You must render this element inside a <DataRouterStateContext.Provider> element");
	return context;
}
var FrameworkContext = import_react.createContext(void 0);
FrameworkContext.displayName = "FrameworkContext";
function useFrameworkContext() {
	let context = import_react.useContext(FrameworkContext);
	invariant2(context, "You must render this element inside a <HydratedRouter> element");
	return context;
}
function usePrefetchBehavior(prefetch, theirElementProps) {
	let frameworkContext = import_react.useContext(FrameworkContext);
	let [maybePrefetch, setMaybePrefetch] = import_react.useState(false);
	let [shouldPrefetch, setShouldPrefetch] = import_react.useState(false);
	let { onFocus, onBlur, onMouseEnter, onMouseLeave, onTouchStart } = theirElementProps;
	let ref = import_react.useRef(null);
	import_react.useEffect(() => {
		if (prefetch === "render") setShouldPrefetch(true);
		if (prefetch === "viewport") {
			let callback = (entries) => {
				entries.forEach((entry) => {
					setShouldPrefetch(entry.isIntersecting);
				});
			};
			let observer = new IntersectionObserver(callback, { threshold: .5 });
			if (ref.current) observer.observe(ref.current);
			return () => {
				observer.disconnect();
			};
		}
	}, [prefetch]);
	import_react.useEffect(() => {
		if (maybePrefetch) {
			let id$1 = setTimeout(() => {
				setShouldPrefetch(true);
			}, 100);
			return () => {
				clearTimeout(id$1);
			};
		}
	}, [maybePrefetch]);
	let setIntent = () => {
		setMaybePrefetch(true);
	};
	let cancelIntent = () => {
		setMaybePrefetch(false);
		setShouldPrefetch(false);
	};
	if (!frameworkContext) return [
		false,
		ref,
		{}
	];
	if (prefetch !== "intent") return [
		shouldPrefetch,
		ref,
		{}
	];
	return [
		shouldPrefetch,
		ref,
		{
			onFocus: composeEventHandlers$1(onFocus, setIntent),
			onBlur: composeEventHandlers$1(onBlur, cancelIntent),
			onMouseEnter: composeEventHandlers$1(onMouseEnter, setIntent),
			onMouseLeave: composeEventHandlers$1(onMouseLeave, cancelIntent),
			onTouchStart: composeEventHandlers$1(onTouchStart, setIntent)
		}
	];
}
function composeEventHandlers$1(theirHandler, ourHandler) {
	return (event) => {
		theirHandler && theirHandler(event);
		if (!event.defaultPrevented) ourHandler(event);
	};
}
function PrefetchPageLinks({ page, ...linkProps }) {
	let rsc = useIsRSCRouterContext();
	let { nonce: contextNonce } = useFrameworkContext();
	let { router } = useDataRouterContext2();
	let matches = import_react.useMemo(() => matchRoutes(router.routes, page, router.basename), [
		router.routes,
		page,
		router.basename
	]);
	if (!matches) return null;
	if (linkProps.nonce == null && contextNonce) linkProps = {
		...linkProps,
		nonce: contextNonce
	};
	if (rsc) return /* @__PURE__ */ import_react.createElement(RSCPrefetchPageLinksImpl, {
		page,
		matches,
		...linkProps
	});
	return /* @__PURE__ */ import_react.createElement(PrefetchPageLinksImpl, {
		page,
		matches,
		...linkProps
	});
}
function useKeyedPrefetchLinks(matches) {
	let { manifest, routeModules } = useFrameworkContext();
	let [keyedPrefetchLinks, setKeyedPrefetchLinks] = import_react.useState([]);
	import_react.useEffect(() => {
		let interrupted = false;
		getKeyedPrefetchLinks(matches, manifest, routeModules).then((links) => {
			if (!interrupted) setKeyedPrefetchLinks(links);
		});
		return () => {
			interrupted = true;
		};
	}, [
		matches,
		manifest,
		routeModules
	]);
	return keyedPrefetchLinks;
}
function RSCPrefetchPageLinksImpl({ page, matches: nextMatches, ...linkProps }) {
	let location = useLocation();
	let { future } = useFrameworkContext();
	let { basename } = useDataRouterContext2();
	let dataHrefs = import_react.useMemo(() => {
		if (page === location.pathname + location.search + location.hash) return [];
		let url = singleFetchUrl(page, basename, future.v8_trailingSlashAwareDataRequests, "rsc");
		let hasSomeRoutesWithShouldRevalidate = false;
		let targetRoutes = [];
		for (let match of nextMatches) if (typeof match.route.shouldRevalidate === "function") hasSomeRoutesWithShouldRevalidate = true;
		else targetRoutes.push(match.route.id);
		if (hasSomeRoutesWithShouldRevalidate && targetRoutes.length > 0) url.searchParams.set("_routes", targetRoutes.join(","));
		return [url.pathname + url.search];
	}, [
		basename,
		future.v8_trailingSlashAwareDataRequests,
		page,
		location,
		nextMatches
	]);
	return /* @__PURE__ */ import_react.createElement(import_react.Fragment, null, dataHrefs.map((href) => /* @__PURE__ */ import_react.createElement("link", {
		key: href,
		rel: "prefetch",
		as: "fetch",
		href,
		...linkProps
	})));
}
function PrefetchPageLinksImpl({ page, matches: nextMatches, ...linkProps }) {
	let location = useLocation();
	let { future, manifest, routeModules } = useFrameworkContext();
	let { basename } = useDataRouterContext2();
	let { loaderData, matches } = useDataRouterStateContext();
	let newMatchesForData = import_react.useMemo(() => getNewMatchesForLinks(page, nextMatches, matches, manifest, location, "data"), [
		page,
		nextMatches,
		matches,
		manifest,
		location
	]);
	let newMatchesForAssets = import_react.useMemo(() => getNewMatchesForLinks(page, nextMatches, matches, manifest, location, "assets"), [
		page,
		nextMatches,
		matches,
		manifest,
		location
	]);
	let dataHrefs = import_react.useMemo(() => {
		if (page === location.pathname + location.search + location.hash) return [];
		let routesParams = /* @__PURE__ */ new Set();
		let foundOptOutRoute = false;
		nextMatches.forEach((m$2) => {
			let manifestRoute = manifest.routes[m$2.route.id];
			if (!manifestRoute || !manifestRoute.hasLoader) return;
			if (!newMatchesForData.some((m2) => m2.route.id === m$2.route.id) && m$2.route.id in loaderData && routeModules[m$2.route.id]?.shouldRevalidate) foundOptOutRoute = true;
			else if (manifestRoute.hasClientLoader) foundOptOutRoute = true;
			else routesParams.add(m$2.route.id);
		});
		if (routesParams.size === 0) return [];
		let url = singleFetchUrl(page, basename, future.v8_trailingSlashAwareDataRequests, "data");
		if (foundOptOutRoute && routesParams.size > 0) url.searchParams.set("_routes", nextMatches.filter((m$2) => routesParams.has(m$2.route.id)).map((m$2) => m$2.route.id).join(","));
		return [url.pathname + url.search];
	}, [
		basename,
		future.v8_trailingSlashAwareDataRequests,
		loaderData,
		location,
		manifest,
		newMatchesForData,
		nextMatches,
		page,
		routeModules
	]);
	let moduleHrefs = import_react.useMemo(() => getModuleLinkHrefs(newMatchesForAssets, manifest), [newMatchesForAssets, manifest]);
	let keyedPrefetchLinks = useKeyedPrefetchLinks(newMatchesForAssets);
	return /* @__PURE__ */ import_react.createElement(import_react.Fragment, null, dataHrefs.map((href) => /* @__PURE__ */ import_react.createElement("link", {
		key: href,
		rel: "prefetch",
		as: "fetch",
		href,
		...linkProps
	})), moduleHrefs.map((href) => /* @__PURE__ */ import_react.createElement("link", {
		key: href,
		rel: "modulepreload",
		href,
		...linkProps
	})), keyedPrefetchLinks.map(({ key, link }) => /* @__PURE__ */ import_react.createElement("link", {
		key,
		nonce: linkProps.nonce,
		...link,
		crossOrigin: link.crossOrigin ?? linkProps.crossOrigin
	})));
}
function mergeRefs(...refs) {
	return (value) => {
		refs.forEach((ref) => {
			if (typeof ref === "function") ref(value);
			else if (ref != null) ref.current = value;
		});
	};
}
var isBrowser2 = typeof window !== "undefined" && typeof window.document !== "undefined" && typeof window.document.createElement !== "undefined";
try {
	if (isBrowser2) window.__reactRouterVersion = "7.18.2";
} catch (e) {}
function HashRouter({ basename, children, useTransitions, window: window2 }) {
	let historyRef = import_react.useRef();
	if (historyRef.current == null) historyRef.current = createHashHistory({
		window: window2,
		v5Compat: true
	});
	let history = historyRef.current;
	let [state, setStateImpl] = import_react.useState({
		action: history.action,
		location: history.location
	});
	let setState = import_react.useCallback((newState) => {
		if (useTransitions === false) setStateImpl(newState);
		else import_react.startTransition(() => setStateImpl(newState));
	}, [useTransitions]);
	import_react.useLayoutEffect(() => history.listen(setState), [history, setState]);
	return /* @__PURE__ */ import_react.createElement(Router, {
		basename,
		children,
		location: state.location,
		navigationType: state.action,
		navigator: history,
		useTransitions
	});
}
function HistoryRouter({ basename, children, history, useTransitions }) {
	let [state, setStateImpl] = import_react.useState({
		action: history.action,
		location: history.location
	});
	let setState = import_react.useCallback((newState) => {
		if (useTransitions === false) setStateImpl(newState);
		else import_react.startTransition(() => setStateImpl(newState));
	}, [useTransitions]);
	import_react.useLayoutEffect(() => history.listen(setState), [history, setState]);
	return /* @__PURE__ */ import_react.createElement(Router, {
		basename,
		children,
		location: state.location,
		navigationType: state.action,
		navigator: history,
		useTransitions
	});
}
HistoryRouter.displayName = "unstable_HistoryRouter";
var Link = import_react.forwardRef(function LinkWithRef({ onClick, discover = "render", prefetch = "none", relative, reloadDocument, replace: replace2, mask, state, target, to, preventScrollReset, viewTransition, defaultShouldRevalidate, ...rest }, forwardedRef) {
	let { basename, navigator: navigator$1, useTransitions } = import_react.useContext(NavigationContext);
	let isAbsolute = typeof to === "string" && ABSOLUTE_URL_REGEX.test(to);
	let parsed = parseToInfo(to, basename);
	to = parsed.to;
	let href = useHref(to, { relative });
	let location = useLocation();
	let maskedHref = null;
	if (mask) {
		let resolved = resolveTo(mask, [], location.mask ? location.mask.pathname : "/", true);
		if (basename !== "/") resolved.pathname = resolved.pathname === "/" ? basename : joinPaths([basename, resolved.pathname]);
		maskedHref = navigator$1.createHref(resolved);
	}
	let [shouldPrefetch, prefetchRef, prefetchHandlers] = usePrefetchBehavior(prefetch, rest);
	let internalOnClick = useLinkClickHandler(to, {
		replace: replace2,
		mask,
		state,
		target,
		preventScrollReset,
		relative,
		viewTransition,
		defaultShouldRevalidate,
		useTransitions
	});
	function handleClick(event) {
		if (onClick) onClick(event);
		if (!event.defaultPrevented) internalOnClick(event);
	}
	let isSpaLink = !(parsed.isExternal || reloadDocument);
	let link = /* @__PURE__ */ import_react.createElement("a", {
		...rest,
		...prefetchHandlers,
		href: (isSpaLink ? maskedHref : void 0) || parsed.absoluteURL || href,
		onClick: isSpaLink ? handleClick : onClick,
		ref: mergeRefs(forwardedRef, prefetchRef),
		target,
		"data-discover": !isAbsolute && discover === "render" ? "true" : void 0
	});
	return shouldPrefetch && !isAbsolute ? /* @__PURE__ */ import_react.createElement(import_react.Fragment, null, link, /* @__PURE__ */ import_react.createElement(PrefetchPageLinks, { page: href })) : link;
});
Link.displayName = "Link";
var NavLink = import_react.forwardRef(function NavLinkWithRef({ "aria-current": ariaCurrentProp = "page", caseSensitive = false, className: classNameProp = "", end = false, style: styleProp, to, viewTransition, children, ...rest }, ref) {
	let path = useResolvedPath(to, { relative: rest.relative });
	let location = useLocation();
	let routerState = import_react.useContext(DataRouterStateContext);
	let { navigator: navigator$1, basename } = import_react.useContext(NavigationContext);
	let isTransitioning = routerState != null && useViewTransitionState(path) && viewTransition === true;
	let toPathname = navigator$1.encodeLocation ? navigator$1.encodeLocation(path).pathname : path.pathname;
	let locationPathname = location.pathname;
	let nextLocationPathname = routerState && routerState.navigation && routerState.navigation.location ? routerState.navigation.location.pathname : null;
	if (!caseSensitive) {
		locationPathname = locationPathname.toLowerCase();
		nextLocationPathname = nextLocationPathname ? nextLocationPathname.toLowerCase() : null;
		toPathname = toPathname.toLowerCase();
	}
	if (nextLocationPathname && basename) nextLocationPathname = stripBasename(nextLocationPathname, basename) || nextLocationPathname;
	const endSlashPosition = toPathname !== "/" && toPathname.endsWith("/") ? toPathname.length - 1 : toPathname.length;
	let isActive = locationPathname === toPathname || !end && locationPathname.startsWith(toPathname) && locationPathname.charAt(endSlashPosition) === "/";
	let isPending = nextLocationPathname != null && (nextLocationPathname === toPathname || !end && nextLocationPathname.startsWith(toPathname) && nextLocationPathname.charAt(toPathname.length) === "/");
	let renderProps = {
		isActive,
		isPending,
		isTransitioning
	};
	let ariaCurrent = isActive ? ariaCurrentProp : void 0;
	let className;
	if (typeof classNameProp === "function") className = classNameProp(renderProps);
	else className = [
		classNameProp,
		isActive ? "active" : null,
		isPending ? "pending" : null,
		isTransitioning ? "transitioning" : null
	].filter(Boolean).join(" ");
	let style = typeof styleProp === "function" ? styleProp(renderProps) : styleProp;
	return /* @__PURE__ */ import_react.createElement(Link, {
		...rest,
		"aria-current": ariaCurrent,
		className,
		ref,
		style,
		to,
		viewTransition
	}, typeof children === "function" ? children(renderProps) : children);
});
NavLink.displayName = "NavLink";
var Form = import_react.forwardRef(({ discover = "render", fetcherKey, navigate, reloadDocument, replace: replace2, state, method = defaultMethod, action, onSubmit, relative, preventScrollReset, viewTransition, defaultShouldRevalidate, ...props }, forwardedRef) => {
	let { useTransitions } = import_react.useContext(NavigationContext);
	let submit = useSubmit();
	let formAction = useFormAction(action, { relative });
	let formMethod = method.toLowerCase() === "get" ? "get" : "post";
	let isAbsolute = typeof action === "string" && ABSOLUTE_URL_REGEX.test(action);
	let submitHandler = (event) => {
		onSubmit && onSubmit(event);
		if (event.defaultPrevented) return;
		event.preventDefault();
		let submitter = event.nativeEvent.submitter;
		let submitMethod = submitter?.getAttribute("formmethod") || method;
		let doSubmit = () => submit(submitter || event.currentTarget, {
			fetcherKey,
			method: submitMethod,
			navigate,
			replace: replace2,
			state,
			relative,
			preventScrollReset,
			viewTransition,
			defaultShouldRevalidate
		});
		if (useTransitions && navigate !== false) import_react.startTransition(() => doSubmit());
		else doSubmit();
	};
	return /* @__PURE__ */ import_react.createElement("form", {
		ref: forwardedRef,
		method: formMethod,
		action: formAction,
		onSubmit: reloadDocument ? onSubmit : submitHandler,
		...props,
		"data-discover": !isAbsolute && discover === "render" ? "true" : void 0
	});
});
Form.displayName = "Form";
function ScrollRestoration({ getKey, storageKey, ...props }) {
	let remixContext = import_react.useContext(FrameworkContext);
	let { basename } = import_react.useContext(NavigationContext);
	let location = useLocation();
	let matches = useMatches();
	useScrollRestoration({
		getKey,
		storageKey
	});
	let ssrKey = import_react.useMemo(() => {
		if (!remixContext || !getKey) return null;
		let userKey = getScrollRestorationKey(location, matches, basename, getKey);
		return userKey !== location.key ? userKey : null;
	}, []);
	if (!remixContext || remixContext.isSpaMode) return null;
	let restoreScroll = ((storageKey2, restoreKey) => {
		if (!window.history.state || !window.history.state.key) {
			let key = Math.random().toString(32).slice(2);
			window.history.replaceState({ key }, "");
		}
		try {
			let storedY = JSON.parse(sessionStorage.getItem(storageKey2) || "{}")[restoreKey || window.history.state.key];
			if (typeof storedY === "number") window.scrollTo(0, storedY);
		} catch (error$1) {
			console.error(error$1);
			sessionStorage.removeItem(storageKey2);
		}
	}).toString();
	if (props.nonce == null && remixContext?.nonce) props.nonce = remixContext.nonce;
	return /* @__PURE__ */ import_react.createElement("script", {
		...props,
		suppressHydrationWarning: true,
		dangerouslySetInnerHTML: { __html: `(${restoreScroll})(${escapeHtml(JSON.stringify(storageKey || SCROLL_RESTORATION_STORAGE_KEY))}, ${escapeHtml(JSON.stringify(ssrKey))})` }
	});
}
ScrollRestoration.displayName = "ScrollRestoration";
function getDataRouterConsoleError2(hookName) {
	return `${hookName} must be used within a data router.  See https://reactrouter.com/en/main/routers/picking-a-router.`;
}
function useDataRouterContext3(hookName) {
	let ctx = import_react.useContext(DataRouterContext);
	invariant$2(ctx, getDataRouterConsoleError2(hookName));
	return ctx;
}
function useDataRouterState2(hookName) {
	let state = import_react.useContext(DataRouterStateContext);
	invariant$2(state, getDataRouterConsoleError2(hookName));
	return state;
}
function useLinkClickHandler(to, { target, replace: replaceProp, mask, state, preventScrollReset, relative, viewTransition, defaultShouldRevalidate, useTransitions } = {}) {
	let navigate = useNavigate();
	let location = useLocation();
	let path = useResolvedPath(to, { relative });
	return import_react.useCallback((event) => {
		if (shouldProcessLinkClick(event, target)) {
			event.preventDefault();
			let replace2 = replaceProp !== void 0 ? replaceProp : createPath(location) === createPath(path);
			let doNavigate = () => navigate(to, {
				replace: replace2,
				mask,
				state,
				preventScrollReset,
				relative,
				viewTransition,
				defaultShouldRevalidate
			});
			if (useTransitions) import_react.startTransition(() => doNavigate());
			else doNavigate();
		}
	}, [
		location,
		navigate,
		path,
		replaceProp,
		mask,
		state,
		target,
		to,
		preventScrollReset,
		relative,
		viewTransition,
		defaultShouldRevalidate,
		useTransitions
	]);
}
var fetcherId = 0;
var getUniqueFetcherId = () => `__${String(++fetcherId)}__`;
function useSubmit() {
	let { router } = useDataRouterContext3("useSubmit");
	let { basename } = import_react.useContext(NavigationContext);
	let currentRouteId = useRouteId();
	let routerFetch = router.fetch;
	let routerNavigate = router.navigate;
	return import_react.useCallback(async (target, options = {}) => {
		let { action, method, encType, formData, body } = getFormSubmissionInfo(target, basename);
		if (options.navigate === false) await routerFetch(options.fetcherKey || getUniqueFetcherId(), currentRouteId, options.action || action, {
			defaultShouldRevalidate: options.defaultShouldRevalidate,
			preventScrollReset: options.preventScrollReset,
			formData,
			body,
			formMethod: options.method || method,
			formEncType: options.encType || encType,
			flushSync: options.flushSync
		});
		else await routerNavigate(options.action || action, {
			defaultShouldRevalidate: options.defaultShouldRevalidate,
			preventScrollReset: options.preventScrollReset,
			formData,
			body,
			formMethod: options.method || method,
			formEncType: options.encType || encType,
			replace: options.replace,
			state: options.state,
			fromRouteId: currentRouteId,
			flushSync: options.flushSync,
			viewTransition: options.viewTransition
		});
	}, [
		routerFetch,
		routerNavigate,
		basename,
		currentRouteId
	]);
}
function useFormAction(action, { relative } = {}) {
	let { basename } = import_react.useContext(NavigationContext);
	let routeContext = import_react.useContext(RouteContext);
	invariant$2(routeContext, "useFormAction must be used inside a RouteContext");
	let [match] = routeContext.matches.slice(-1);
	let path = { ...useResolvedPath(action ? action : ".", { relative }) };
	let location = useLocation();
	if (action == null) {
		path.search = location.search;
		let params = new URLSearchParams(path.search);
		let indexValues = params.getAll("index");
		if (indexValues.some((v$3) => v$3 === "")) {
			params.delete("index");
			indexValues.filter((v$3) => v$3).forEach((v$3) => params.append("index", v$3));
			let qs = params.toString();
			path.search = qs ? `?${qs}` : "";
		}
	}
	if ((!action || action === ".") && match.route.index) path.search = path.search ? path.search.replace(/^\?/, "?index&") : "?index";
	if (basename !== "/") path.pathname = path.pathname === "/" ? basename : joinPaths([basename, path.pathname]);
	return createPath(path);
}
var SCROLL_RESTORATION_STORAGE_KEY = "react-router-scroll-positions";
var savedScrollPositions = {};
function getScrollRestorationKey(location, matches, basename, getKey) {
	let key = null;
	if (getKey) if (basename !== "/") key = getKey({
		...location,
		pathname: stripBasename(location.pathname, basename) || location.pathname
	}, matches);
	else key = getKey(location, matches);
	if (key == null) key = location.key;
	return key;
}
function useScrollRestoration({ getKey, storageKey } = {}) {
	let { router } = useDataRouterContext3("useScrollRestoration");
	let { restoreScrollPosition, preventScrollReset } = useDataRouterState2("useScrollRestoration");
	let { basename } = import_react.useContext(NavigationContext);
	let location = useLocation();
	let matches = useMatches();
	let navigation = useNavigation();
	import_react.useEffect(() => {
		window.history.scrollRestoration = "manual";
		return () => {
			window.history.scrollRestoration = "auto";
		};
	}, []);
	usePageHide(import_react.useCallback(() => {
		if (navigation.state === "idle") {
			let key = getScrollRestorationKey(location, matches, basename, getKey);
			savedScrollPositions[key] = window.scrollY;
		}
		try {
			sessionStorage.setItem(storageKey || SCROLL_RESTORATION_STORAGE_KEY, JSON.stringify(savedScrollPositions));
		} catch (error$1) {
			warning(false, `Failed to save scroll positions in sessionStorage, <ScrollRestoration /> will not work properly (${error$1}).`);
		}
		window.history.scrollRestoration = "auto";
	}, [
		navigation.state,
		getKey,
		basename,
		location,
		matches,
		storageKey
	]));
	if (typeof document !== "undefined") {
		import_react.useLayoutEffect(() => {
			try {
				let sessionPositions = sessionStorage.getItem(storageKey || SCROLL_RESTORATION_STORAGE_KEY);
				if (sessionPositions) savedScrollPositions = JSON.parse(sessionPositions);
			} catch (e) {}
		}, [storageKey]);
		import_react.useLayoutEffect(() => {
			let disableScrollRestoration = router?.enableScrollRestoration(savedScrollPositions, () => window.scrollY, getKey ? (location2, matches2) => getScrollRestorationKey(location2, matches2, basename, getKey) : void 0);
			return () => disableScrollRestoration && disableScrollRestoration();
		}, [
			router,
			basename,
			getKey
		]);
		import_react.useLayoutEffect(() => {
			if (restoreScrollPosition === false) return;
			if (typeof restoreScrollPosition === "number") {
				window.scrollTo(0, restoreScrollPosition);
				return;
			}
			try {
				if (location.hash) {
					let el$1 = document.getElementById(decodeURIComponent(location.hash.slice(1)));
					if (el$1) {
						el$1.scrollIntoView();
						return;
					}
				}
			} catch {
				warning(false, `"${location.hash.slice(1)}" is not a decodable element ID. The view will not scroll to it.`);
			}
			if (preventScrollReset === true) return;
			window.scrollTo(0, 0);
		}, [
			location,
			restoreScrollPosition,
			preventScrollReset
		]);
	}
}
function usePageHide(callback, options) {
	let { capture } = options || {};
	import_react.useEffect(() => {
		let opts = capture != null ? { capture } : void 0;
		window.addEventListener("pagehide", callback, opts);
		return () => {
			window.removeEventListener("pagehide", callback, opts);
		};
	}, [callback, capture]);
}
function useViewTransitionState(to, { relative } = {}) {
	let vtContext = import_react.useContext(ViewTransitionContext);
	invariant$2(vtContext != null, "`useViewTransitionState` must be used within `react-router-dom`'s `RouterProvider`.  Did you accidentally import `RouterProvider` from `react-router`?");
	let { basename } = useDataRouterContext3("useViewTransitionState");
	let path = useResolvedPath(to, { relative });
	if (!vtContext.isTransitioning) return false;
	let currentPath = stripBasename(vtContext.currentLocation.pathname, basename) || vtContext.currentLocation.pathname;
	let nextPath = stripBasename(vtContext.nextLocation.pathname, basename) || vtContext.nextLocation.pathname;
	return matchPath(path.pathname, nextPath) != null || matchPath(path.pathname, currentPath) != null;
}
var import_client = require_client();
function g(n$2, i) {
	return {
		handler: n$2,
		config: i
	};
}
g.withOptions = function(n$2, i = () => ({})) {
	function t$2(o) {
		return {
			handler: n$2(o),
			config: i(o)
		};
	}
	return t$2.__isOptionsFunction = true, t$2;
};
var u = g;
var observer_default = {
	start() {
		if (document.readyState === "loading") {
			document.addEventListener("DOMContentLoaded", () => this.observe());
			return;
		}
		this.observe();
	},
	restart() {
		this._observers.forEach((observer) => observer.disconnect());
		this._observers = [];
		this.observe();
	},
	observe() {
		document.querySelectorAll([
			"[class*=\" intersect:\"]",
			"[class*=\":intersect:\"]",
			"[class^=\"intersect:\"]",
			"[class=\"intersect\"]",
			"[class*=\" intersect \"]",
			"[class^=\"intersect \"]",
			"[class$=\" intersect\"]"
		].join(",")).forEach((element) => {
			const observer = new IntersectionObserver((entries) => {
				entries.forEach((entry) => {
					if (!entry.isIntersecting) {
						element.setAttribute("no-intersect", "");
						return;
					}
					element.removeAttribute("no-intersect");
					element.classList.contains("intersect-once") && observer.disconnect();
				});
			}, { threshold: this._getThreshold(element) });
			observer.observe(element);
			this._observers.push(observer);
		});
	},
	_getThreshold(element) {
		if (element.classList.contains("intersect-full")) return .99;
		if (element.classList.contains("intersect-half")) return .5;
		return 0;
	},
	_observers: []
};
u(({ addVariant }) => {
	addVariant("intersect", "&:not([no-intersect])");
});
var IntersectObserver = () => {
	(0, import_react.useEffect)(() => {
		const timer = setTimeout(() => {
			observer_default.restart();
		}, 100);
		return () => clearTimeout(timer);
	}, [useLocation()]);
	return null;
}, IntersectObserver_default = IntersectObserver, M = (e, i, s, u$3, m$2, a, l$3, h$1) => {
	let d = document.documentElement, w$1 = ["light", "dark"];
	function p$4(n$2) {
		(Array.isArray(e) ? e : [e]).forEach((y$2) => {
			let k$2 = y$2 === "class", S$3 = k$2 && a ? m$2.map((f$2) => a[f$2] || f$2) : m$2;
			k$2 ? (d.classList.remove(...S$3), d.classList.add(a && a[n$2] ? a[n$2] : n$2)) : d.setAttribute(y$2, n$2);
		}), R$3(n$2);
	}
	function R$3(n$2) {
		h$1 && w$1.includes(n$2) && (d.style.colorScheme = n$2);
	}
	function c() {
		return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
	}
	if (u$3) p$4(u$3);
	else try {
		let n$2 = localStorage.getItem(i) || s;
		p$4(l$3 && n$2 === "system" ? c() : n$2);
	} catch (n$2) {}
}, x = import_react.createContext(void 0), U = {
	setTheme: (e) => {},
	themes: []
}, z = () => {
	var e;
	return (e = import_react.useContext(x)) != null ? e : U;
};
import_react.memo(({ forcedTheme: e, storageKey: i, attribute: s, enableSystem: u$3, enableColorScheme: m$2, defaultTheme: a, value: l$3, themes: h$1, nonce: d, scriptProps: w$1 }) => {
	let p$4 = JSON.stringify([
		s,
		i,
		a,
		e,
		h$1,
		l$3,
		u$3,
		m$2
	]).slice(1, -1);
	return import_react.createElement("script", {
		...w$1,
		suppressHydrationWarning: !0,
		nonce: typeof window == "undefined" ? d : "",
		dangerouslySetInnerHTML: { __html: `(${M.toString()})(${p$4})` }
	});
});
var import_react_dom$3 = /* @__PURE__ */ __toESM(require_react_dom(), 1);
function __insertCSS(code) {
	if (!code || typeof document == "undefined") return;
	let head = document.head || document.getElementsByTagName("head")[0];
	let style = document.createElement("style");
	style.type = "text/css";
	head.appendChild(style);
	style.styleSheet ? style.styleSheet.cssText = code : style.appendChild(document.createTextNode(code));
}
var getAsset = (type) => {
	switch (type) {
		case "success": return SuccessIcon;
		case "info": return InfoIcon;
		case "warning": return WarningIcon;
		case "error": return ErrorIcon;
		default: return null;
	}
};
var bars = Array(12).fill(0);
var Loader = ({ visible, className }) => {
	return /* @__PURE__ */ import_react.createElement("div", {
		className: ["sonner-loading-wrapper", className].filter(Boolean).join(" "),
		"data-visible": visible
	}, /* @__PURE__ */ import_react.createElement("div", { className: "sonner-spinner" }, bars.map((_$1, i) => /* @__PURE__ */ import_react.createElement("div", {
		className: "sonner-loading-bar",
		key: `spinner-bar-${i}`
	}))));
};
var SuccessIcon = /* @__PURE__ */ import_react.createElement("svg", {
	xmlns: "http://www.w3.org/2000/svg",
	viewBox: "0 0 20 20",
	fill: "currentColor",
	height: "20",
	width: "20",
	"aria-hidden": "true"
}, /* @__PURE__ */ import_react.createElement("path", {
	fillRule: "evenodd",
	d: "M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z",
	clipRule: "evenodd"
}));
var WarningIcon = /* @__PURE__ */ import_react.createElement("svg", {
	xmlns: "http://www.w3.org/2000/svg",
	viewBox: "0 0 24 24",
	fill: "currentColor",
	height: "20",
	width: "20",
	"aria-hidden": "true"
}, /* @__PURE__ */ import_react.createElement("path", {
	fillRule: "evenodd",
	d: "M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z",
	clipRule: "evenodd"
}));
var InfoIcon = /* @__PURE__ */ import_react.createElement("svg", {
	xmlns: "http://www.w3.org/2000/svg",
	viewBox: "0 0 20 20",
	fill: "currentColor",
	height: "20",
	width: "20",
	"aria-hidden": "true"
}, /* @__PURE__ */ import_react.createElement("path", {
	fillRule: "evenodd",
	d: "M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z",
	clipRule: "evenodd"
}));
var ErrorIcon = /* @__PURE__ */ import_react.createElement("svg", {
	xmlns: "http://www.w3.org/2000/svg",
	viewBox: "0 0 20 20",
	fill: "currentColor",
	height: "20",
	width: "20",
	"aria-hidden": "true"
}, /* @__PURE__ */ import_react.createElement("path", {
	fillRule: "evenodd",
	d: "M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z",
	clipRule: "evenodd"
}));
var CloseIcon = /* @__PURE__ */ import_react.createElement("svg", {
	xmlns: "http://www.w3.org/2000/svg",
	width: "12",
	height: "12",
	viewBox: "0 0 24 24",
	fill: "none",
	stroke: "currentColor",
	strokeWidth: "1.5",
	strokeLinecap: "round",
	strokeLinejoin: "round",
	"aria-hidden": "true"
}, /* @__PURE__ */ import_react.createElement("line", {
	x1: "18",
	y1: "6",
	x2: "6",
	y2: "18"
}), /* @__PURE__ */ import_react.createElement("line", {
	x1: "6",
	y1: "6",
	x2: "18",
	y2: "18"
}));
var useIsDocumentHidden = () => {
	const [isDocumentHidden, setIsDocumentHidden] = import_react.useState(document.hidden);
	import_react.useEffect(() => {
		const callback = () => {
			setIsDocumentHidden(document.hidden);
		};
		document.addEventListener("visibilitychange", callback);
		return () => document.removeEventListener("visibilitychange", callback);
	}, []);
	return isDocumentHidden;
};
var toastsCounter = 1;
var MAX_HISTORY_SIZE = 100;
var getToastId = (data) => {
	var _data_id;
	return typeof (data == null ? void 0 : data.id) === "number" || (data == null ? void 0 : (_data_id = data.id) == null ? void 0 : _data_id.length) > 0 ? data.id : toastsCounter++;
};
var Observer = class {
	constructor() {
		this.subscribe = (subscriber) => {
			this.subscribers.push(subscriber);
			this.getActiveToasts().forEach((toast$1) => subscriber(toast$1));
			return () => {
				const index$1 = this.subscribers.indexOf(subscriber);
				this.subscribers.splice(index$1, 1);
			};
		};
		this.publish = (data) => {
			this.subscribers.forEach((subscriber) => subscriber(data));
		};
		this.addToast = (data) => {
			this.publish(data);
			this.toasts = [...this.toasts, data];
			this.trimHistory();
		};
		this.trimHistory = () => {
			let toRemove = this.toasts.length - MAX_HISTORY_SIZE;
			if (toRemove <= 0) return;
			this.toasts = this.toasts.filter((toast$1) => {
				if (toRemove > 0 && this.dismissedToasts.has(toast$1.id)) {
					this.dismissedToasts.delete(toast$1.id);
					toRemove--;
					return false;
				}
				return true;
			});
		};
		this.create = (data) => {
			const { message, ...rest } = data;
			const id$1 = getToastId(data);
			const pendingDismissal = this.pendingDismissals.get(id$1);
			if (pendingDismissal !== void 0) {
				cancelAnimationFrame(pendingDismissal);
				this.pendingDismissals.delete(id$1);
				this.dismissedToasts.delete(id$1);
			}
			const wasDismissed = this.dismissedToasts.has(id$1);
			const dismissible = data.dismissible === void 0 ? true : data.dismissible;
			if (wasDismissed) {
				this.dismissedToasts.delete(id$1);
				this.toasts = this.toasts.filter((toast$1) => toast$1.id !== id$1);
			}
			if (wasDismissed ? void 0 : this.toasts.find((toast$1) => {
				return toast$1.id === id$1;
			})) this.toasts = this.toasts.map((toast$1) => {
				if (toast$1.id === id$1) {
					this.publish({
						...toast$1,
						...data,
						id: id$1,
						title: message
					});
					return {
						...toast$1,
						...data,
						id: id$1,
						dismissible,
						title: message
					};
				}
				return toast$1;
			});
			else this.addToast({
				title: message,
				...rest,
				dismissible,
				id: id$1
			});
			return id$1;
		};
		this.dismiss = (id$1) => {
			if (id$1 === void 0 || id$1 === null) {
				this.getActiveToasts().forEach((toast$1) => {
					this.dismissedToasts.add(toast$1.id);
					this.subscribers.forEach((subscriber) => subscriber({
						id: toast$1.id,
						dismiss: true
					}));
				});
				return id$1;
			}
			this.dismissedToasts.add(id$1);
			const alreadyPending = this.pendingDismissals.get(id$1);
			if (alreadyPending !== void 0) cancelAnimationFrame(alreadyPending);
			this.pendingDismissals.set(id$1, requestAnimationFrame(() => {
				this.pendingDismissals.delete(id$1);
				this.subscribers.forEach((subscriber) => subscriber({
					id: id$1,
					dismiss: true
				}));
			}));
			return id$1;
		};
		this.message = (message, data) => {
			return this.create({
				...data,
				message,
				type: void 0
			});
		};
		this.error = (message, data) => {
			return this.create({
				...data,
				message,
				type: "error"
			});
		};
		this.success = (message, data) => {
			return this.create({
				...data,
				type: "success",
				message
			});
		};
		this.info = (message, data) => {
			return this.create({
				...data,
				type: "info",
				message
			});
		};
		this.warning = (message, data) => {
			return this.create({
				...data,
				type: "warning",
				message
			});
		};
		this.loading = (message, data) => {
			return this.create({
				...data,
				type: "loading",
				message
			});
		};
		this.promise = (promise, data) => {
			if (!data) return;
			let id$1 = void 0;
			if (data.loading !== void 0) id$1 = this.create({
				...data,
				promise,
				type: "loading",
				message: data.loading,
				description: typeof data.description !== "function" ? data.description : void 0
			});
			const p$4 = Promise.resolve(promise instanceof Function ? promise() : promise);
			let shouldDismiss = id$1 !== void 0;
			let result;
			const originalPromise = p$4.then(async (response) => {
				result = ["resolve", response];
				if (import_react.isValidElement(response)) {
					shouldDismiss = false;
					this.create({
						id: id$1,
						type: "default",
						message: response
					});
				} else if (isHttpResponse(response) && !response.ok) {
					shouldDismiss = false;
					const promiseData = typeof data.error === "function" ? await data.error(`HTTP error! status: ${response.status}`) : data.error;
					const description = typeof data.description === "function" ? await data.description(`HTTP error! status: ${response.status}`) : data.description;
					const toastSettings = typeof promiseData === "object" && !import_react.isValidElement(promiseData) ? promiseData : { message: promiseData };
					this.create({
						id: id$1,
						type: "error",
						description,
						...toastSettings
					});
				} else if (response instanceof Error) {
					shouldDismiss = false;
					const promiseData = typeof data.error === "function" ? await data.error(response) : data.error;
					const description = typeof data.description === "function" ? await data.description(response) : data.description;
					const toastSettings = typeof promiseData === "object" && !import_react.isValidElement(promiseData) ? promiseData : { message: promiseData };
					this.create({
						id: id$1,
						type: "error",
						description,
						...toastSettings
					});
				} else if (data.success !== void 0) {
					shouldDismiss = false;
					const promiseData = typeof data.success === "function" ? await data.success(response) : data.success;
					const description = typeof data.description === "function" ? await data.description(response) : data.description;
					const toastSettings = typeof promiseData === "object" && !import_react.isValidElement(promiseData) ? promiseData : { message: promiseData };
					this.create({
						id: id$1,
						type: "success",
						description,
						...toastSettings
					});
				}
			}).catch(async (error$1) => {
				result = ["reject", error$1];
				if (data.error !== void 0) {
					shouldDismiss = false;
					const promiseData = typeof data.error === "function" ? await data.error(error$1) : data.error;
					const description = typeof data.description === "function" ? await data.description(error$1) : data.description;
					const toastSettings = typeof promiseData === "object" && !import_react.isValidElement(promiseData) ? promiseData : { message: promiseData };
					this.create({
						id: id$1,
						type: "error",
						description,
						...toastSettings
					});
				}
			}).finally(() => {
				if (shouldDismiss) {
					this.dismiss(id$1);
					id$1 = void 0;
				}
				data.finally == null || data.finally.call(data);
			});
			const unwrap = () => new Promise((resolve, reject) => originalPromise.then(() => result[0] === "reject" ? reject(result[1]) : resolve(result[1])).catch(reject));
			if (typeof id$1 !== "string" && typeof id$1 !== "number") return { unwrap };
			else return Object.assign(id$1, { unwrap });
		};
		this.custom = (jsx$7, data) => {
			const id$1 = getToastId(data);
			this.create({
				...data,
				jsx: jsx$7(id$1),
				id: id$1,
				type: void 0
			});
			return id$1;
		};
		this.getActiveToasts = () => {
			return this.toasts.filter((toast$1) => !this.dismissedToasts.has(toast$1.id));
		};
		this.subscribers = [];
		this.toasts = [];
		this.dismissedToasts = /* @__PURE__ */ new Set();
		this.pendingDismissals = /* @__PURE__ */ new Map();
	}
};
var ToastState = new Observer();
var toastFunction = (message, data) => {
	return ToastState.message(message, data);
};
var isHttpResponse = (data) => {
	return data && typeof data === "object" && "ok" in data && typeof data.ok === "boolean" && "status" in data && typeof data.status === "number";
};
var basicToast = toastFunction;
var getHistory = () => ToastState.toasts;
var getToasts = () => ToastState.getActiveToasts();
Object.assign(basicToast, {
	success: ToastState.success,
	info: ToastState.info,
	warning: ToastState.warning,
	error: ToastState.error,
	custom: ToastState.custom,
	message: ToastState.message,
	promise: ToastState.promise,
	dismiss: ToastState.dismiss,
	loading: ToastState.loading
}, {
	getHistory,
	getToasts
});
__insertCSS("[data-sonner-toaster][dir=ltr],html[dir=ltr]{--toast-icon-margin-start:-3px;--toast-icon-margin-end:4px;--toast-svg-margin-start:-1px;--toast-svg-margin-end:0px;--toast-button-margin-start:auto;--toast-button-margin-end:0;--toast-close-button-start:0;--toast-close-button-end:unset;--toast-close-button-transform:translate(-35%, -35%)}[data-sonner-toaster][dir=rtl],html[dir=rtl]{--toast-icon-margin-start:4px;--toast-icon-margin-end:-3px;--toast-svg-margin-start:0px;--toast-svg-margin-end:-1px;--toast-button-margin-start:0;--toast-button-margin-end:auto;--toast-close-button-start:unset;--toast-close-button-end:0;--toast-close-button-transform:translate(35%, -35%)}[data-sonner-toaster]{position:fixed;width:var(--width);font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica Neue,Arial,Noto Sans,sans-serif,Apple Color Emoji,Segoe UI Emoji,Segoe UI Symbol,Noto Color Emoji;--gray1:hsl(0, 0%, 99%);--gray2:hsl(0, 0%, 97.3%);--gray3:hsl(0, 0%, 95.1%);--gray4:hsl(0, 0%, 93%);--gray5:hsl(0, 0%, 90.9%);--gray6:hsl(0, 0%, 88.7%);--gray7:hsl(0, 0%, 85.8%);--gray8:hsl(0, 0%, 78%);--gray9:hsl(0, 0%, 56.1%);--gray10:hsl(0, 0%, 52.3%);--gray11:hsl(0, 0%, 43.5%);--gray12:hsl(0, 0%, 9%);--border-radius:8px;box-sizing:border-box;padding:0;margin:0;list-style:none;outline:0;z-index:999999999;transition:transform .4s ease}@media (hover:none) and (pointer:coarse){[data-sonner-toaster][data-lifted=true]{transform:none}}[data-sonner-toaster][data-x-position=right]{right:var(--offset-right)}[data-sonner-toaster][data-x-position=left]{left:var(--offset-left)}[data-sonner-toaster][data-x-position=center]{left:50%;transform:translateX(-50%)}[data-sonner-toaster][data-y-position=top]{top:var(--offset-top)}[data-sonner-toaster][data-y-position=bottom]{bottom:var(--offset-bottom)}[data-sonner-toast]{--y:translateY(100%);--lift-amount:calc(var(--lift) * var(--gap));z-index:var(--z-index);position:absolute;opacity:0;transform:var(--y);touch-action:none;transition:transform .4s,opacity .4s,height .4s,box-shadow .2s;box-sizing:border-box;outline:0;overflow-wrap:anywhere}[data-sonner-toast][data-styled=true]{padding:16px;background:var(--normal-bg);border:1px solid var(--normal-border);color:var(--normal-text);border-radius:var(--border-radius);box-shadow:0 4px 12px rgba(0,0,0,.1);width:var(--width);font-size:13px;display:flex;align-items:center;gap:6px}[data-sonner-toast]:focus-visible{box-shadow:0 4px 12px rgba(0,0,0,.1),0 0 0 2px rgba(0,0,0,.2)}[data-sonner-toast][data-y-position=top]{top:0;--y:translateY(-100%);--lift:1;--lift-amount:calc(1 * var(--gap))}[data-sonner-toast][data-y-position=bottom]{bottom:0;--y:translateY(100%);--lift:-1;--lift-amount:calc(var(--lift) * var(--gap))}[data-sonner-toast][data-styled=true] [data-description]{font-weight:400;line-height:1.4;color:#3f3f3f}[data-rich-colors=true][data-sonner-toast][data-styled=true] [data-description]{color:inherit}[data-sonner-toaster][data-sonner-theme=dark] [data-description]{color:#e8e8e8}[data-sonner-toast][data-styled=true] [data-title]{font-weight:500;line-height:1.5;color:inherit}[data-sonner-toast][data-styled=true] [data-icon]{display:flex;height:16px;width:16px;position:relative;justify-content:flex-start;align-items:center;flex-shrink:0;margin-left:var(--toast-icon-margin-start);margin-right:var(--toast-icon-margin-end)}[data-sonner-toast][data-promise=true] [data-icon]>svg{opacity:0;transform:scale(.8);transform-origin:center;animation:sonner-fade-in .3s ease forwards}[data-sonner-toast][data-styled=true] [data-icon]>*{flex-shrink:0}[data-sonner-toast][data-styled=true] [data-icon] svg{margin-left:var(--toast-svg-margin-start);margin-right:var(--toast-svg-margin-end)}[data-sonner-toast][data-styled=true] [data-content]{display:flex;flex-direction:column;gap:2px;flex:1;min-width:0}[data-sonner-toast][data-styled=true] [data-button]{border-radius:4px;padding-left:8px;padding-right:8px;height:24px;font-size:12px;color:var(--normal-bg);background:var(--normal-text);margin-left:var(--toast-button-margin-start);margin-right:var(--toast-button-margin-end);border:none;font-weight:500;cursor:pointer;outline:0;display:flex;align-items:center;flex-shrink:0;transition:opacity .4s,box-shadow .2s}[data-sonner-toast][data-styled=true] [data-button]:focus-visible{box-shadow:0 0 0 2px rgba(0,0,0,.4)}[data-sonner-toast][data-styled=true] [data-button]:first-of-type{margin-left:var(--toast-button-margin-start);margin-right:var(--toast-button-margin-end)}[data-sonner-toast][data-styled=true] [data-cancel]{color:var(--normal-text);background:rgba(0,0,0,.08)}[data-sonner-toaster][data-sonner-theme=dark] [data-sonner-toast][data-styled=true] [data-cancel]{background:rgba(255,255,255,.3)}[data-sonner-toast][data-styled=true] [data-close-button]{position:absolute;left:var(--toast-close-button-start);right:var(--toast-close-button-end);top:0;height:20px;width:20px;display:flex;justify-content:center;align-items:center;padding:0;color:var(--normal-text);background:var(--normal-bg);border:1px solid var(--normal-border);transform:var(--toast-close-button-transform);border-radius:50%;cursor:pointer;z-index:1;transition:opacity .1s,background .2s,border-color .2s}[data-sonner-toast][data-styled=true] [data-close-button]:focus-visible{box-shadow:0 4px 12px rgba(0,0,0,.1),0 0 0 2px rgba(0,0,0,.2)}[data-sonner-toast][data-styled=true] [data-disabled=true]{cursor:not-allowed}[data-sonner-toast][data-styled=true]:hover [data-close-button]:hover{background:var(--gray2);border-color:var(--gray5)}[data-sonner-toast][data-swiping=true]::before{content:'';position:absolute;left:-100%;right:-100%;height:100%;z-index:-1}[data-sonner-toast][data-y-position=top][data-swiping=true]::before{bottom:50%;transform:scaleY(3) translateY(50%)}[data-sonner-toast][data-y-position=bottom][data-swiping=true]::before{top:50%;transform:scaleY(3) translateY(-50%)}[data-sonner-toast][data-swiping=false][data-removed=true]::before{content:'';position:absolute;inset:0;transform:scaleY(2)}[data-sonner-toast][data-expanded=true]::after{content:'';position:absolute;left:0;height:calc(var(--gap) + 1px);bottom:100%;width:100%}[data-sonner-toast][data-mounted=true]{--y:translateY(0);opacity:1}[data-sonner-toast][data-expanded=false][data-front=false]{--scale:var(--toasts-before) * 0.05 + 1;--y:translateY(calc(var(--lift-amount) * var(--toasts-before))) scale(calc(-1 * var(--scale)));height:var(--front-toast-height)}[data-sonner-toast]>*{transition:opacity .4s}[data-sonner-toast][data-x-position=right]{right:0}[data-sonner-toast][data-x-position=left]{left:0}[data-sonner-toast][data-expanded=false][data-front=false][data-styled=true]>*{opacity:0}[data-sonner-toast][data-visible=false]{opacity:0;pointer-events:none}[data-sonner-toast][data-mounted=true][data-expanded=true]{--y:translateY(calc(var(--lift) * var(--offset)));height:var(--initial-height)}[data-sonner-toast][data-removed=true][data-front=true][data-swipe-out=false]{--y:translateY(calc(var(--lift) * -100%));opacity:0}[data-sonner-toast][data-removed=true][data-front=false][data-swipe-out=false][data-expanded=true]{--y:translateY(calc(var(--lift) * var(--offset) + var(--lift) * -100%));opacity:0}[data-sonner-toast][data-removed=true][data-front=false][data-swipe-out=false][data-expanded=false]{--y:translateY(40%);opacity:0;transition:transform .5s,opacity .2s}[data-sonner-toast][data-removed=true][data-front=false]::before{height:calc(var(--initial-height) + 20%)}[data-sonner-toast][data-swiping=true]{transform:var(--y) translateY(var(--swipe-amount-y,0)) translateX(var(--swipe-amount-x,0));transition:none}[data-sonner-toast][data-swiped=true]{-webkit-user-select:none;user-select:none}[data-sonner-toast][data-swipe-out=true][data-y-position=bottom],[data-sonner-toast][data-swipe-out=true][data-y-position=top]{animation-duration:.2s;animation-timing-function:ease-out;animation-fill-mode:forwards}[data-sonner-toast][data-swipe-out=true][data-swipe-direction=left]{animation-name:swipe-out-left}[data-sonner-toast][data-swipe-out=true][data-swipe-direction=right]{animation-name:swipe-out-right}[data-sonner-toast][data-swipe-out=true][data-swipe-direction=up]{animation-name:swipe-out-up}[data-sonner-toast][data-swipe-out=true][data-swipe-direction=down]{animation-name:swipe-out-down}@keyframes swipe-out-left{from{transform:var(--y) translateX(var(--swipe-amount-x));opacity:1}to{transform:var(--y) translateX(calc(var(--swipe-amount-x) - 100%));opacity:0}}@keyframes swipe-out-right{from{transform:var(--y) translateX(var(--swipe-amount-x));opacity:1}to{transform:var(--y) translateX(calc(var(--swipe-amount-x) + 100%));opacity:0}}@keyframes swipe-out-up{from{transform:var(--y) translateY(var(--swipe-amount-y));opacity:1}to{transform:var(--y) translateY(calc(var(--swipe-amount-y) - 100%));opacity:0}}@keyframes swipe-out-down{from{transform:var(--y) translateY(var(--swipe-amount-y));opacity:1}to{transform:var(--y) translateY(calc(var(--swipe-amount-y) + 100%));opacity:0}}@media (max-width:600px){[data-sonner-toaster]{position:fixed;right:var(--mobile-offset-right);left:var(--mobile-offset-left);width:100%}[data-sonner-toaster][dir=rtl]{left:calc(var(--mobile-offset-left) * -1)}[data-sonner-toaster] [data-sonner-toast]{left:0;right:0;width:calc(100% - var(--mobile-offset-left) * 2)}[data-sonner-toaster][data-x-position=left]{left:var(--mobile-offset-left)}[data-sonner-toaster][data-y-position=bottom]{bottom:var(--mobile-offset-bottom)}[data-sonner-toaster][data-y-position=top]{top:var(--mobile-offset-top)}[data-sonner-toaster][data-x-position=center]{left:var(--mobile-offset-left);right:var(--mobile-offset-right);transform:none}}[data-sonner-toaster][data-sonner-theme=light]{--normal-bg:#fff;--normal-border:var(--gray4);--normal-text:var(--gray12);--success-bg:hsl(143, 85%, 96%);--success-border:hsl(145, 92%, 87%);--success-text:hsl(140, 100%, 27%);--info-bg:hsl(208, 100%, 97%);--info-border:hsl(221, 91%, 93%);--info-text:hsl(210, 92%, 45%);--warning-bg:hsl(49, 100%, 97%);--warning-border:hsl(49, 91%, 84%);--warning-text:hsl(31, 92%, 45%);--error-bg:hsl(359, 100%, 97%);--error-border:hsl(359, 100%, 94%);--error-text:hsl(360, 100%, 45%)}[data-sonner-toaster][data-sonner-theme=light] [data-sonner-toast][data-invert=true]{--normal-bg:#000;--normal-border:hsl(0, 0%, 20%);--normal-text:var(--gray1)}[data-sonner-toaster][data-sonner-theme=dark] [data-sonner-toast][data-invert=true]{--normal-bg:#fff;--normal-border:var(--gray3);--normal-text:var(--gray12)}[data-sonner-toaster][data-sonner-theme=dark]{--normal-bg:#000;--normal-bg-hover:hsl(0, 0%, 12%);--normal-border:hsl(0, 0%, 20%);--normal-border-hover:hsl(0, 0%, 25%);--normal-text:var(--gray1);--success-bg:hsl(150, 100%, 6%);--success-border:hsl(147, 100%, 12%);--success-text:hsl(150, 86%, 65%);--info-bg:hsl(215, 100%, 6%);--info-border:hsl(223, 43%, 17%);--info-text:hsl(216, 87%, 65%);--warning-bg:hsl(64, 100%, 6%);--warning-border:hsl(60, 100%, 9%);--warning-text:hsl(46, 87%, 65%);--error-bg:hsl(358, 76%, 10%);--error-border:hsl(357, 89%, 16%);--error-text:hsl(358, 100%, 81%)}[data-sonner-toaster][data-sonner-theme=dark] [data-sonner-toast] [data-close-button]{background:var(--normal-bg);border-color:var(--normal-border);color:var(--normal-text)}[data-sonner-toaster][data-sonner-theme=dark] [data-sonner-toast] [data-close-button]:hover{background:var(--normal-bg-hover);border-color:var(--normal-border-hover)}[data-rich-colors=true][data-sonner-toast][data-type=success]{background:var(--success-bg);border-color:var(--success-border);color:var(--success-text)}[data-rich-colors=true][data-sonner-toast][data-type=success] [data-close-button]{background:var(--success-bg);border-color:var(--success-border);color:var(--success-text)}[data-rich-colors=true][data-sonner-toast][data-type=info]{background:var(--info-bg);border-color:var(--info-border);color:var(--info-text)}[data-rich-colors=true][data-sonner-toast][data-type=info] [data-close-button]{background:var(--info-bg);border-color:var(--info-border);color:var(--info-text)}[data-rich-colors=true][data-sonner-toast][data-type=warning]{background:var(--warning-bg);border-color:var(--warning-border);color:var(--warning-text)}[data-rich-colors=true][data-sonner-toast][data-type=warning] [data-close-button]{background:var(--warning-bg);border-color:var(--warning-border);color:var(--warning-text)}[data-rich-colors=true][data-sonner-toast][data-type=error]{background:var(--error-bg);border-color:var(--error-border);color:var(--error-text)}[data-rich-colors=true][data-sonner-toast][data-type=error] [data-close-button]{background:var(--error-bg);border-color:var(--error-border);color:var(--error-text)}.sonner-loading-wrapper{--size:16px;height:var(--size);width:var(--size);position:absolute;inset:0;z-index:10}.sonner-loading-wrapper[data-visible=false]{transform-origin:center;animation:sonner-fade-out .2s ease forwards}.sonner-spinner{position:relative;top:50%;left:50%;height:var(--size);width:var(--size)}.sonner-loading-bar{animation:sonner-spin 1.2s linear infinite;background:var(--gray11);border-radius:6px;height:8%;left:-10%;position:absolute;top:-3.9%;width:24%}.sonner-loading-bar:first-child{animation-delay:-1.2s;transform:rotate(.0001deg) translate(146%)}.sonner-loading-bar:nth-child(2){animation-delay:-1.1s;transform:rotate(30deg) translate(146%)}.sonner-loading-bar:nth-child(3){animation-delay:-1s;transform:rotate(60deg) translate(146%)}.sonner-loading-bar:nth-child(4){animation-delay:-.9s;transform:rotate(90deg) translate(146%)}.sonner-loading-bar:nth-child(5){animation-delay:-.8s;transform:rotate(120deg) translate(146%)}.sonner-loading-bar:nth-child(6){animation-delay:-.7s;transform:rotate(150deg) translate(146%)}.sonner-loading-bar:nth-child(7){animation-delay:-.6s;transform:rotate(180deg) translate(146%)}.sonner-loading-bar:nth-child(8){animation-delay:-.5s;transform:rotate(210deg) translate(146%)}.sonner-loading-bar:nth-child(9){animation-delay:-.4s;transform:rotate(240deg) translate(146%)}.sonner-loading-bar:nth-child(10){animation-delay:-.3s;transform:rotate(270deg) translate(146%)}.sonner-loading-bar:nth-child(11){animation-delay:-.2s;transform:rotate(300deg) translate(146%)}.sonner-loading-bar:nth-child(12){animation-delay:-.1s;transform:rotate(330deg) translate(146%)}@keyframes sonner-fade-in{0%{opacity:0;transform:scale(.8)}100%{opacity:1;transform:scale(1)}}@keyframes sonner-fade-out{0%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(.8)}}@keyframes sonner-spin{0%{opacity:1}100%{opacity:.15}}@media (prefers-reduced-motion){.sonner-loading-bar,[data-sonner-toast],[data-sonner-toast]>*{transition:none!important;animation:none!important}}.sonner-loader{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);transform-origin:center;transition:opacity .2s,transform .2s}.sonner-loader[data-visible=false]{opacity:0;transform:scale(.8) translate(-50%,-50%)}");
function isAction(action) {
	return action.label !== void 0;
}
var VISIBLE_TOASTS_AMOUNT = 3;
var VIEWPORT_OFFSET = "24px";
var MOBILE_VIEWPORT_OFFSET = "16px";
var TOAST_LIFETIME = 4e3;
var TOAST_WIDTH = 356;
var GAP = 14;
var SWIPE_THRESHOLD = 45;
var TIME_BEFORE_UNMOUNT = 200;
function cn$1(...classes) {
	return classes.filter(Boolean).join(" ");
}
function getDefaultSwipeDirections(position) {
	const [y$2, x$2] = position.split("-");
	const directions = [];
	if (y$2) directions.push(y$2);
	if (x$2) directions.push(x$2);
	return directions;
}
var Toast = (props) => {
	var _toast_classNames, _toast_classNames1, _toast_classNames2, _toast_classNames3, _toast_classNames4, _toast_classNames5, _toast_classNames6, _toast_classNames7, _toast_classNames8;
	const { invert: ToasterInvert, toast: toast$1, unstyled, interacting, setHeights, visibleToasts, heights, index: index$1, toasts, expanded, removeToast, defaultRichColors, closeButton: closeButtonFromToaster, style, cancelButtonStyle, actionButtonStyle, className = "", descriptionClassName = "", duration: durationFromToaster, position, gap, expandByDefault, classNames, icons, closeButtonAriaLabel = "Close toast" } = props;
	const [swipeDirection, setSwipeDirection] = import_react.useState(null);
	const [swipeOutDirection, setSwipeOutDirection] = import_react.useState(null);
	const [mounted, setMounted] = import_react.useState(false);
	const [removed, setRemoved] = import_react.useState(false);
	const [swiping, setSwiping] = import_react.useState(false);
	const [swipeOut, setSwipeOut] = import_react.useState(false);
	const [isSwiped, setIsSwiped] = import_react.useState(false);
	const [offsetBeforeRemove, setOffsetBeforeRemove] = import_react.useState(0);
	const [initialHeight, setInitialHeight] = import_react.useState(0);
	const remainingTime = import_react.useRef(toast$1.duration || durationFromToaster || TOAST_LIFETIME);
	const dragStartTime = import_react.useRef(null);
	const toastRef = import_react.useRef(null);
	const isFront = index$1 === 0;
	const isVisible = index$1 + 1 <= visibleToasts;
	const toastType = toast$1.type;
	const toastTypeKey = toastType != null ? toastType : "default";
	const dismissible = toast$1.dismissible !== false;
	const toastClassname = toast$1.className || "";
	const toastDescriptionClassname = toast$1.descriptionClassName || "";
	const heightIndex = import_react.useMemo(() => heights.findIndex((height) => height.toastId === toast$1.id) || 0, [heights, toast$1.id]);
	const closeButton = import_react.useMemo(() => {
		var _toast_closeButton;
		return (_toast_closeButton = toast$1.closeButton) != null ? _toast_closeButton : closeButtonFromToaster;
	}, [toast$1.closeButton, closeButtonFromToaster]);
	const duration = import_react.useMemo(() => toast$1.duration || durationFromToaster || TOAST_LIFETIME, [toast$1.duration, durationFromToaster]);
	const closeTimerStartTimeRef = import_react.useRef(0);
	const offset$3 = import_react.useRef(0);
	const lastCloseTimerStartTimeRef = import_react.useRef(0);
	const pointerStartRef = import_react.useRef(null);
	const [y$2, x$2] = position.split("-");
	const toastsHeightBefore = import_react.useMemo(() => {
		return heights.reduce((prev, curr, reducerIndex) => {
			if (reducerIndex >= heightIndex) return prev;
			return prev + curr.height;
		}, 0);
	}, [heights, heightIndex]);
	const isDocumentHidden = useIsDocumentHidden();
	const swipeDirections = import_react.useMemo(() => {
		var _props_swipeDirections;
		return (_props_swipeDirections = props.swipeDirections) != null ? _props_swipeDirections : getDefaultSwipeDirections(position);
	}, [props.swipeDirections, position]);
	const invert = toast$1.invert || ToasterInvert;
	const disabled = toastType === "loading";
	offset$3.current = import_react.useMemo(() => heightIndex * gap + toastsHeightBefore, [heightIndex, toastsHeightBefore]);
	import_react.useEffect(() => {
		remainingTime.current = duration;
	}, [duration]);
	import_react.useEffect(() => {
		setMounted(true);
	}, []);
	import_react.useEffect(() => {
		const toastNode = toastRef.current;
		if (toastNode) {
			const height = toastNode.getBoundingClientRect().height;
			setInitialHeight(height);
			setHeights((h$1) => [{
				toastId: toast$1.id,
				height,
				position: toast$1.position
			}, ...h$1]);
			return () => setHeights((h$1) => h$1.filter((height$1) => height$1.toastId !== toast$1.id));
		}
	}, [setHeights, toast$1.id]);
	import_react.useLayoutEffect(() => {
		if (!mounted) return;
		const toastNode = toastRef.current;
		const originalHeight = toastNode.style.height;
		toastNode.style.height = "auto";
		const newHeight = toastNode.getBoundingClientRect().height;
		toastNode.style.height = originalHeight;
		setInitialHeight(newHeight);
		setHeights((heights$1) => {
			if (!heights$1.find((height) => height.toastId === toast$1.id)) return [{
				toastId: toast$1.id,
				height: newHeight,
				position: toast$1.position
			}, ...heights$1];
			else return heights$1.map((height) => height.toastId === toast$1.id ? {
				...height,
				height: newHeight
			} : height);
		});
	}, [
		mounted,
		toast$1.title,
		toast$1.description,
		setHeights,
		toast$1.id,
		toast$1.jsx,
		toast$1.action,
		toast$1.cancel
	]);
	const deleteToast = import_react.useCallback(() => {
		setRemoved(true);
		setOffsetBeforeRemove(offset$3.current);
		setHeights((h$1) => h$1.filter((height) => height.toastId !== toast$1.id));
		setTimeout(() => {
			removeToast(toast$1);
		}, TIME_BEFORE_UNMOUNT);
	}, [
		toast$1,
		removeToast,
		setHeights,
		offset$3
	]);
	import_react.useEffect(() => {
		if (toast$1.promise && toastType === "loading" || toast$1.duration === Infinity || toast$1.type === "loading") return;
		let timeoutId;
		const pauseTimer = () => {
			if (lastCloseTimerStartTimeRef.current < closeTimerStartTimeRef.current) {
				const elapsedTime = (/* @__PURE__ */ new Date()).getTime() - closeTimerStartTimeRef.current;
				remainingTime.current = remainingTime.current - elapsedTime;
			}
			lastCloseTimerStartTimeRef.current = (/* @__PURE__ */ new Date()).getTime();
		};
		const startTimer = () => {
			if (remainingTime.current === Infinity) return;
			closeTimerStartTimeRef.current = (/* @__PURE__ */ new Date()).getTime();
			timeoutId = setTimeout(() => {
				toast$1.onAutoClose == null || toast$1.onAutoClose.call(toast$1, toast$1);
				deleteToast();
			}, remainingTime.current);
		};
		if (expanded || interacting || isDocumentHidden) pauseTimer();
		else startTimer();
		return () => clearTimeout(timeoutId);
	}, [
		expanded,
		interacting,
		toast$1,
		toastType,
		isDocumentHidden,
		deleteToast
	]);
	import_react.useEffect(() => {
		if (toast$1.delete) {
			deleteToast();
			toast$1.onDismiss == null || toast$1.onDismiss.call(toast$1, toast$1);
		}
	}, [deleteToast, toast$1.delete]);
	function getLoadingIcon() {
		var _toast_classNames$1;
		if (icons == null ? void 0 : icons.loading) {
			var _toast_classNames1$1;
			return /* @__PURE__ */ import_react.createElement("div", {
				className: cn$1(classNames == null ? void 0 : classNames.loader, toast$1 == null ? void 0 : (_toast_classNames1$1 = toast$1.classNames) == null ? void 0 : _toast_classNames1$1.loader, "sonner-loader"),
				"data-visible": toastType === "loading"
			}, icons.loading);
		}
		return /* @__PURE__ */ import_react.createElement(Loader, {
			className: cn$1(classNames == null ? void 0 : classNames.loader, toast$1 == null ? void 0 : (_toast_classNames$1 = toast$1.classNames) == null ? void 0 : _toast_classNames$1.loader),
			visible: toastType === "loading"
		});
	}
	const icon = toast$1.icon || (icons == null ? void 0 : icons[toastType]) || getAsset(toastType);
	var _toast_richColors, _icons_close;
	return /* @__PURE__ */ import_react.createElement("li", {
		tabIndex: 0,
		ref: toastRef,
		className: cn$1(className, toastClassname, classNames == null ? void 0 : classNames.toast, toast$1 == null ? void 0 : (_toast_classNames = toast$1.classNames) == null ? void 0 : _toast_classNames.toast, classNames == null ? void 0 : classNames[toastTypeKey], toast$1 == null ? void 0 : (_toast_classNames1 = toast$1.classNames) == null ? void 0 : _toast_classNames1[toastTypeKey]),
		"data-sonner-toast": "",
		"data-rich-colors": (_toast_richColors = toast$1.richColors) != null ? _toast_richColors : defaultRichColors,
		"data-styled": !Boolean(toast$1.jsx || toast$1.unstyled || unstyled),
		"data-mounted": mounted,
		"data-promise": Boolean(toast$1.promise),
		"data-swiped": isSwiped,
		"data-removed": removed,
		"data-visible": isVisible,
		"data-y-position": y$2,
		"data-x-position": x$2,
		"data-index": index$1,
		"data-front": isFront,
		"data-swiping": swiping,
		"data-dismissible": dismissible,
		"data-type": toastType,
		"data-invert": invert,
		"data-swipe-out": swipeOut,
		"data-swipe-direction": swipeOutDirection,
		"data-expanded": Boolean(expanded || expandByDefault && mounted),
		"data-testid": toast$1.testId,
		style: {
			"--index": index$1,
			"--toasts-before": index$1,
			"--z-index": toasts.length - index$1,
			"--offset": `${removed ? offsetBeforeRemove : offset$3.current}px`,
			"--initial-height": expandByDefault ? "auto" : `${initialHeight}px`,
			...style,
			...toast$1.style
		},
		onDragEnd: () => {
			setSwiping(false);
			setSwipeDirection(null);
			pointerStartRef.current = null;
		},
		onPointerDown: (event) => {
			if (event.button === 2) return;
			if (disabled || !dismissible) return;
			dragStartTime.current = /* @__PURE__ */ new Date();
			setOffsetBeforeRemove(offset$3.current);
			event.target.setPointerCapture(event.pointerId);
			if (event.target.tagName === "BUTTON") return;
			setSwiping(true);
			pointerStartRef.current = {
				x: event.clientX,
				y: event.clientY
			};
		},
		onPointerUp: () => {
			var _toastRef_current, _toastRef_current1, _dragStartTime_current;
			if (swipeOut || !dismissible) return;
			pointerStartRef.current = null;
			const swipeAmountX = Number(((_toastRef_current = toastRef.current) == null ? void 0 : _toastRef_current.style.getPropertyValue("--swipe-amount-x").replace("px", "")) || 0);
			const swipeAmountY = Number(((_toastRef_current1 = toastRef.current) == null ? void 0 : _toastRef_current1.style.getPropertyValue("--swipe-amount-y").replace("px", "")) || 0);
			const timeTaken = (/* @__PURE__ */ new Date()).getTime() - ((_dragStartTime_current = dragStartTime.current) == null ? void 0 : _dragStartTime_current.getTime());
			const swipeAmount = swipeDirection === "x" ? swipeAmountX : swipeAmountY;
			const velocity = Math.abs(swipeAmount) / timeTaken;
			if ((swipeDirection === "x" ? swipeDirections.includes(swipeAmountX > 0 ? "right" : "left") : swipeDirections.includes(swipeAmountY > 0 ? "bottom" : "top")) && (Math.abs(swipeAmount) >= SWIPE_THRESHOLD || velocity > .11)) {
				setOffsetBeforeRemove(offset$3.current);
				toast$1.onDismiss == null || toast$1.onDismiss.call(toast$1, toast$1);
				if (swipeDirection === "x") setSwipeOutDirection(swipeAmountX > 0 ? "right" : "left");
				else setSwipeOutDirection(swipeAmountY > 0 ? "down" : "up");
				deleteToast();
				setSwipeOut(true);
				return;
			} else {
				var _toastRef_current2, _toastRef_current3;
				(_toastRef_current2 = toastRef.current) == null || _toastRef_current2.style.setProperty("--swipe-amount-x", `0px`);
				(_toastRef_current3 = toastRef.current) == null || _toastRef_current3.style.setProperty("--swipe-amount-y", `0px`);
			}
			setIsSwiped(false);
			setSwiping(false);
			setSwipeDirection(null);
		},
		onPointerMove: (event) => {
			var _window_getSelection, _toastRef_current, _toastRef_current1;
			if (!pointerStartRef.current || !dismissible) return;
			if (((_window_getSelection = window.getSelection()) == null ? void 0 : _window_getSelection.toString().length) > 0) return;
			const yDelta = event.clientY - pointerStartRef.current.y;
			const xDelta = event.clientX - pointerStartRef.current.x;
			if (!swipeDirection && (Math.abs(xDelta) > 1 || Math.abs(yDelta) > 1)) setSwipeDirection(Math.abs(xDelta) > Math.abs(yDelta) ? "x" : "y");
			let swipeAmount = {
				x: 0,
				y: 0
			};
			const getDampening = (delta) => {
				return 1 / (1.5 + Math.abs(delta) / 20);
			};
			if (swipeDirection === "y") {
				if (swipeDirections.includes("top") || swipeDirections.includes("bottom")) if (swipeDirections.includes("top") && yDelta < 0 || swipeDirections.includes("bottom") && yDelta > 0) swipeAmount.y = yDelta;
				else {
					const dampenedDelta = yDelta * getDampening(yDelta);
					swipeAmount.y = Math.abs(dampenedDelta) < Math.abs(yDelta) ? dampenedDelta : yDelta;
				}
			} else if (swipeDirection === "x") {
				if (swipeDirections.includes("left") || swipeDirections.includes("right")) if (swipeDirections.includes("left") && xDelta < 0 || swipeDirections.includes("right") && xDelta > 0) swipeAmount.x = xDelta;
				else {
					const dampenedDelta = xDelta * getDampening(xDelta);
					swipeAmount.x = Math.abs(dampenedDelta) < Math.abs(xDelta) ? dampenedDelta : xDelta;
				}
			}
			if (Math.abs(swipeAmount.x) > 0 || Math.abs(swipeAmount.y) > 0) setIsSwiped(true);
			(_toastRef_current = toastRef.current) == null || _toastRef_current.style.setProperty("--swipe-amount-x", `${swipeAmount.x}px`);
			(_toastRef_current1 = toastRef.current) == null || _toastRef_current1.style.setProperty("--swipe-amount-y", `${swipeAmount.y}px`);
		}
	}, closeButton && !toast$1.jsx && toastType !== "loading" ? /* @__PURE__ */ import_react.createElement("button", {
		"aria-label": closeButtonAriaLabel,
		"data-disabled": disabled,
		"data-close-button": true,
		onClick: disabled || !dismissible ? () => {} : () => {
			deleteToast();
			toast$1.onDismiss == null || toast$1.onDismiss.call(toast$1, toast$1);
		},
		className: cn$1(classNames == null ? void 0 : classNames.closeButton, toast$1 == null ? void 0 : (_toast_classNames2 = toast$1.classNames) == null ? void 0 : _toast_classNames2.closeButton)
	}, (_icons_close = icons == null ? void 0 : icons.close) != null ? _icons_close : CloseIcon) : null, (toastType || toast$1.icon || toast$1.promise) && toast$1.icon !== null && ((icons == null ? void 0 : icons[toastType]) !== null || toast$1.icon) ? /* @__PURE__ */ import_react.createElement("div", {
		"data-icon": "",
		className: cn$1(classNames == null ? void 0 : classNames.icon, toast$1 == null ? void 0 : (_toast_classNames3 = toast$1.classNames) == null ? void 0 : _toast_classNames3.icon)
	}, toastType === "loading" ? toast$1.icon || getLoadingIcon() : toast$1.promise ? getLoadingIcon() : null, toastType !== "loading" ? icon : null) : null, /* @__PURE__ */ import_react.createElement("div", {
		"data-content": "",
		className: cn$1(classNames == null ? void 0 : classNames.content, toast$1 == null ? void 0 : (_toast_classNames4 = toast$1.classNames) == null ? void 0 : _toast_classNames4.content)
	}, /* @__PURE__ */ import_react.createElement("div", {
		"data-title": "",
		className: cn$1(classNames == null ? void 0 : classNames.title, toast$1 == null ? void 0 : (_toast_classNames5 = toast$1.classNames) == null ? void 0 : _toast_classNames5.title)
	}, toast$1.jsx ? toast$1.jsx : typeof toast$1.title === "function" ? toast$1.title() : toast$1.title), toast$1.description ? /* @__PURE__ */ import_react.createElement("div", {
		"data-description": "",
		className: cn$1(descriptionClassName, toastDescriptionClassname, classNames == null ? void 0 : classNames.description, toast$1 == null ? void 0 : (_toast_classNames6 = toast$1.classNames) == null ? void 0 : _toast_classNames6.description)
	}, typeof toast$1.description === "function" ? toast$1.description() : toast$1.description) : null), /* @__PURE__ */ import_react.isValidElement(toast$1.cancel) ? toast$1.cancel : toast$1.cancel && isAction(toast$1.cancel) ? /* @__PURE__ */ import_react.createElement("button", {
		"data-button": true,
		"data-cancel": true,
		style: toast$1.cancelButtonStyle || cancelButtonStyle,
		onClick: (event) => {
			if (!isAction(toast$1.cancel)) return;
			if (!dismissible) return;
			toast$1.cancel.onClick == null || toast$1.cancel.onClick.call(toast$1.cancel, event);
			deleteToast();
		},
		className: cn$1(classNames == null ? void 0 : classNames.cancelButton, toast$1 == null ? void 0 : (_toast_classNames7 = toast$1.classNames) == null ? void 0 : _toast_classNames7.cancelButton)
	}, toast$1.cancel.label) : null, /* @__PURE__ */ import_react.isValidElement(toast$1.action) ? toast$1.action : toast$1.action && isAction(toast$1.action) ? /* @__PURE__ */ import_react.createElement("button", {
		"data-button": true,
		"data-action": true,
		style: toast$1.actionButtonStyle || actionButtonStyle,
		onClick: (event) => {
			if (!isAction(toast$1.action)) return;
			toast$1.action.onClick == null || toast$1.action.onClick.call(toast$1.action, event);
			if (event.defaultPrevented) return;
			deleteToast();
		},
		className: cn$1(classNames == null ? void 0 : classNames.actionButton, toast$1 == null ? void 0 : (_toast_classNames8 = toast$1.classNames) == null ? void 0 : _toast_classNames8.actionButton)
	}, toast$1.action.label) : null);
};
function getDocumentDirection() {
	if (typeof window === "undefined") return "ltr";
	if (typeof document === "undefined") return "ltr";
	const dirAttribute = document.documentElement.getAttribute("dir");
	if (dirAttribute === "auto" || !dirAttribute) return window.getComputedStyle(document.documentElement).direction;
	return dirAttribute;
}
function assignOffset(defaultOffset, mobileOffset) {
	const styles = {};
	[defaultOffset, mobileOffset].forEach((offset$3, index$1) => {
		const isMobile = index$1 === 1;
		const prefix = isMobile ? "--mobile-offset" : "--offset";
		const defaultValue = isMobile ? MOBILE_VIEWPORT_OFFSET : VIEWPORT_OFFSET;
		function assignAll(offset$4) {
			[
				"top",
				"right",
				"bottom",
				"left"
			].forEach((key) => {
				styles[`${prefix}-${key}`] = typeof offset$4 === "number" ? `${offset$4}px` : offset$4;
			});
		}
		if (typeof offset$3 === "number" || typeof offset$3 === "string") assignAll(offset$3);
		else if (typeof offset$3 === "object") [
			"top",
			"right",
			"bottom",
			"left"
		].forEach((key) => {
			if (offset$3[key] === void 0) styles[`${prefix}-${key}`] = defaultValue;
			else styles[`${prefix}-${key}`] = typeof offset$3[key] === "number" ? `${offset$3[key]}px` : offset$3[key];
		});
		else assignAll(defaultValue);
	});
	return styles;
}
var Toaster$1 = /* @__PURE__ */ import_react.forwardRef(function Toaster$2(props, ref) {
	const { id: id$1, invert, position = "bottom-right", hotkey = ["altKey", "KeyT"], expand, closeButton, className, offset: offset$3, mobileOffset, theme = "light", richColors, duration, style, visibleToasts = VISIBLE_TOASTS_AMOUNT, toastOptions, dir = getDocumentDirection(), gap = GAP, icons, customAriaLabel, containerAriaLabel = "Notifications" } = props;
	const [toasts, setToasts] = import_react.useState([]);
	const filteredToasts = import_react.useMemo(() => {
		if (id$1) return toasts.filter((toast$1) => toast$1.toasterId === id$1);
		return toasts.filter((toast$1) => !toast$1.toasterId);
	}, [toasts, id$1]);
	const possiblePositions = import_react.useMemo(() => {
		return Array.from(new Set([position].concat(filteredToasts.filter((toast$1) => toast$1.position).map((toast$1) => toast$1.position))));
	}, [filteredToasts, position]);
	const [heights, setHeights] = import_react.useState([]);
	const [expanded, setExpanded] = import_react.useState(false);
	const [interacting, setInteracting] = import_react.useState(false);
	const [actualTheme, setActualTheme] = import_react.useState(theme !== "system" ? theme : typeof window !== "undefined" ? window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light" : "light");
	const listRef = import_react.useRef(null);
	const hotkeyLabel = hotkey.join("+").replace(/Key/g, "").replace(/Digit/g, "");
	const lastFocusedElementRef = import_react.useRef(null);
	const isFocusWithinRef = import_react.useRef(false);
	const removeToast = import_react.useCallback((toastToRemove) => {
		setToasts((toasts$1) => {
			var _toasts_find;
			if (!((_toasts_find = toasts$1.find((toast$1) => toast$1.id === toastToRemove.id)) == null ? void 0 : _toasts_find.delete)) ToastState.dismiss(toastToRemove.id);
			return toasts$1.filter(({ id: id$2 }) => id$2 !== toastToRemove.id);
		});
	}, []);
	import_react.useEffect(() => {
		return ToastState.subscribe((toast$1) => {
			if (toast$1.dismiss) {
				requestAnimationFrame(() => {
					setToasts((toasts$1) => toasts$1.map((t$2) => t$2.id === toast$1.id ? {
						...t$2,
						delete: true
					} : t$2));
				});
				return;
			}
			setTimeout(() => {
				import_react_dom$3.flushSync(() => {
					setToasts((toasts$1) => {
						const indexOfExistingToast = toasts$1.findIndex((t$2) => t$2.id === toast$1.id);
						if (indexOfExistingToast !== -1) return [
							...toasts$1.slice(0, indexOfExistingToast),
							{
								...toasts$1[indexOfExistingToast],
								...toast$1
							},
							...toasts$1.slice(indexOfExistingToast + 1)
						];
						return [toast$1, ...toasts$1];
					});
				});
			});
		});
	}, []);
	import_react.useEffect(() => {
		if (theme !== "system") {
			setActualTheme(theme);
			return;
		}
		if (theme === "system") if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) setActualTheme("dark");
		else setActualTheme("light");
		if (typeof window === "undefined") return;
		const darkMediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
		try {
			darkMediaQuery.addEventListener("change", ({ matches }) => {
				if (matches) setActualTheme("dark");
				else setActualTheme("light");
			});
		} catch (error$1) {
			darkMediaQuery.addListener(({ matches }) => {
				try {
					if (matches) setActualTheme("dark");
					else setActualTheme("light");
				} catch (e) {
					console.error(e);
				}
			});
		}
	}, [theme]);
	import_react.useEffect(() => {
		if (toasts.length <= 1) setExpanded(false);
	}, [toasts]);
	import_react.useEffect(() => {
		const handleKeyDown = (event) => {
			var _listRef_current;
			if (hotkey.length > 0 && hotkey.every((key) => event[key] || event.code === key)) {
				var _listRef_current1;
				setExpanded(true);
				(_listRef_current1 = listRef.current) == null || _listRef_current1.focus();
			}
			if (event.code === "Escape" && (document.activeElement === listRef.current || ((_listRef_current = listRef.current) == null ? void 0 : _listRef_current.contains(document.activeElement)))) setExpanded(false);
		};
		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [hotkey]);
	import_react.useEffect(() => {
		if (listRef.current) return () => {
			if (lastFocusedElementRef.current) {
				lastFocusedElementRef.current.focus({ preventScroll: true });
				lastFocusedElementRef.current = null;
				isFocusWithinRef.current = false;
			}
		};
	}, [listRef.current]);
	return /* @__PURE__ */ import_react.createElement("section", {
		ref,
		"aria-label": customAriaLabel != null ? customAriaLabel : `${containerAriaLabel} ${hotkeyLabel}`,
		tabIndex: -1,
		"aria-live": "polite",
		"aria-relevant": "additions text",
		"aria-atomic": "false",
		suppressHydrationWarning: true,
		"data-react-aria-top-layer": true
	}, possiblePositions.map((position$1, index$1) => {
		var _heights_;
		const [y$2, x$2] = position$1.split("-");
		if (!filteredToasts.length) return null;
		return /* @__PURE__ */ import_react.createElement("ol", {
			key: position$1,
			dir: dir === "auto" ? getDocumentDirection() : dir,
			tabIndex: -1,
			ref: listRef,
			className,
			"data-sonner-toaster": true,
			"data-sonner-theme": actualTheme,
			"data-y-position": y$2,
			"data-x-position": x$2,
			style: {
				"--front-toast-height": `${((_heights_ = heights[0]) == null ? void 0 : _heights_.height) || 0}px`,
				"--width": `${TOAST_WIDTH}px`,
				"--gap": `${gap}px`,
				...style,
				...assignOffset(offset$3, mobileOffset)
			},
			onBlur: (event) => {
				if (isFocusWithinRef.current && !event.currentTarget.contains(event.relatedTarget)) {
					isFocusWithinRef.current = false;
					if (lastFocusedElementRef.current) {
						lastFocusedElementRef.current.focus({ preventScroll: true });
						lastFocusedElementRef.current = null;
					}
				}
			},
			onFocus: (event) => {
				if (event.target instanceof HTMLElement && event.target.dataset.dismissible === "false") return;
				if (!isFocusWithinRef.current) {
					isFocusWithinRef.current = true;
					lastFocusedElementRef.current = event.relatedTarget;
				}
			},
			onMouseEnter: () => setExpanded(true),
			onMouseMove: () => setExpanded(true),
			onMouseLeave: () => {
				if (!interacting) setExpanded(false);
			},
			onDragEnd: () => setExpanded(false),
			onPointerDown: (event) => {
				if (event.target instanceof HTMLElement && event.target.dataset.dismissible === "false") return;
				setInteracting(true);
			},
			onPointerUp: () => setInteracting(false)
		}, filteredToasts.filter((toast$1) => !toast$1.position && index$1 === 0 || toast$1.position === position$1).map((toast$1, index$2) => {
			var _toastOptions_duration, _toastOptions_closeButton;
			return /* @__PURE__ */ import_react.createElement(Toast, {
				key: toast$1.id,
				icons,
				index: index$2,
				toast: toast$1,
				defaultRichColors: richColors,
				duration: (_toastOptions_duration = toastOptions == null ? void 0 : toastOptions.duration) != null ? _toastOptions_duration : duration,
				className: toastOptions == null ? void 0 : toastOptions.className,
				descriptionClassName: toastOptions == null ? void 0 : toastOptions.descriptionClassName,
				invert,
				visibleToasts,
				closeButton: (_toastOptions_closeButton = toastOptions == null ? void 0 : toastOptions.closeButton) != null ? _toastOptions_closeButton : closeButton,
				interacting,
				position: position$1,
				style: toastOptions == null ? void 0 : toastOptions.style,
				unstyled: toastOptions == null ? void 0 : toastOptions.unstyled,
				classNames: toastOptions == null ? void 0 : toastOptions.classNames,
				cancelButtonStyle: toastOptions == null ? void 0 : toastOptions.cancelButtonStyle,
				actionButtonStyle: toastOptions == null ? void 0 : toastOptions.actionButtonStyle,
				closeButtonAriaLabel: toastOptions == null ? void 0 : toastOptions.closeButtonAriaLabel,
				removeToast,
				toasts: filteredToasts.filter((t$2) => t$2.position == toast$1.position),
				heights: heights.filter((h$1) => h$1.position == toast$1.position),
				setHeights,
				expandByDefault: expand,
				gap,
				expanded,
				swipeDirections: props.swipeDirections
			});
		}));
	}));
});
/**
* @license React
* react-jsx-runtime.production.min.js
*
* Copyright (c) Facebook, Inc. and its affiliates.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*/
var require_react_jsx_runtime_production_min = /* @__PURE__ */ __commonJSMin(((exports) => {
	var f = require_react(), k = Symbol.for("react.element"), m = Object.prototype.hasOwnProperty, n = f.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentOwner, p = {
		key: !0,
		ref: !0,
		__self: !0,
		__source: !0
	};
	function q(c, a, g$2) {
		var b$1, d = {}, e = null, h$1 = null;
		void 0 !== g$2 && (e = "" + g$2);
		void 0 !== a.key && (e = "" + a.key);
		void 0 !== a.ref && (h$1 = a.ref);
		for (b$1 in a) m.call(a, b$1) && !p.hasOwnProperty(b$1) && (d[b$1] = a[b$1]);
		if (c && c.defaultProps) for (b$1 in a = c.defaultProps, a) void 0 === d[b$1] && (d[b$1] = a[b$1]);
		return {
			$$typeof: k,
			type: c,
			key: e,
			ref: h$1,
			props: d,
			_owner: n.current
		};
	}
	exports.jsx = q;
	exports.jsxs = q;
}));
var import_jsx_runtime = /* @__PURE__ */ __toESM((/* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = require_react_jsx_runtime_production_min();
})))(), 1);
var Toaster = ({ ...props }) => {
	const { theme = "system" } = z();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Toaster$1, {
		theme,
		className: "toaster group",
		toastOptions: { classNames: {
			toast: "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
			description: "group-[.toast]:text-muted-foreground",
			actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
			cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground"
		} },
		...props
	});
};
var AkiniPage = () => {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "relative w-screen h-screen overflow-hidden bg-background",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("iframe", {
			ref: (0, import_react.useRef)(null),
			src: "./akini.html?v=20260821j",
			title: "Akini",
			className: "h-full w-full border-0",
			allow: "autoplay; encrypted-media; fullscreen",
			sandbox: "allow-scripts allow-same-origin allow-forms allow-popups allow-downloads allow-modals"
		})
	});
};
var AkiniPage_default = AkiniPage;
const routes = [{
	name: "Akini",
	path: "/",
	element: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AkiniPage_default, {}),
	public: true
}];
var App = () => {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(HashRouter, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(IntersectObserver_default, {}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "flex flex-col min-h-screen",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", {
				className: "flex-grow",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Routes, { children: [routes.map((route, index$1) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Route, {
					path: route.path,
					element: route.element
				}, index$1)), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Route, {
					path: "*",
					element: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Navigate, {
						to: "/",
						replace: true
					})
				})] })
			})
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Toaster, {})
	] });
};
var App_default = App;
var require_react_fast_compare = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var hasElementType = typeof Element !== "undefined";
	var hasMap = typeof Map === "function";
	var hasSet = typeof Set === "function";
	var hasArrayBuffer = typeof ArrayBuffer === "function" && !!ArrayBuffer.isView;
	function equal(a, b$1) {
		if (a === b$1) return true;
		if (a && b$1 && typeof a == "object" && typeof b$1 == "object") {
			if (a.constructor !== b$1.constructor) return false;
			var length, i, keys;
			if (Array.isArray(a)) {
				length = a.length;
				if (length != b$1.length) return false;
				for (i = length; i-- !== 0;) if (!equal(a[i], b$1[i])) return false;
				return true;
			}
			var it;
			if (hasMap && a instanceof Map && b$1 instanceof Map) {
				if (a.size !== b$1.size) return false;
				it = a.entries();
				while (!(i = it.next()).done) if (!b$1.has(i.value[0])) return false;
				it = a.entries();
				while (!(i = it.next()).done) if (!equal(i.value[1], b$1.get(i.value[0]))) return false;
				return true;
			}
			if (hasSet && a instanceof Set && b$1 instanceof Set) {
				if (a.size !== b$1.size) return false;
				it = a.entries();
				while (!(i = it.next()).done) if (!b$1.has(i.value[0])) return false;
				return true;
			}
			if (hasArrayBuffer && ArrayBuffer.isView(a) && ArrayBuffer.isView(b$1)) {
				length = a.length;
				if (length != b$1.length) return false;
				for (i = length; i-- !== 0;) if (a[i] !== b$1[i]) return false;
				return true;
			}
			if (a.constructor === RegExp) return a.source === b$1.source && a.flags === b$1.flags;
			if (a.valueOf !== Object.prototype.valueOf && typeof a.valueOf === "function" && typeof b$1.valueOf === "function") return a.valueOf() === b$1.valueOf();
			if (a.toString !== Object.prototype.toString && typeof a.toString === "function" && typeof b$1.toString === "function") return a.toString() === b$1.toString();
			keys = Object.keys(a);
			length = keys.length;
			if (length !== Object.keys(b$1).length) return false;
			for (i = length; i-- !== 0;) if (!Object.prototype.hasOwnProperty.call(b$1, keys[i])) return false;
			if (hasElementType && a instanceof Element) return false;
			for (i = length; i-- !== 0;) {
				if ((keys[i] === "_owner" || keys[i] === "__v" || keys[i] === "__o") && a.$$typeof) continue;
				if (!equal(a[keys[i]], b$1[keys[i]])) return false;
			}
			return true;
		}
		return a !== a && b$1 !== b$1;
	}
	module.exports = function isEqual(a, b$1) {
		try {
			return equal(a, b$1);
		} catch (error$1) {
			if ((error$1.message || "").match(/stack|recursion/i)) {
				console.warn("react-fast-compare cannot handle circular refs");
				return false;
			}
			throw error$1;
		}
	};
}));
var require_browser = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var invariant$1 = function(condition, format, a, b$1, c, d, e, f$2) {
		if (!condition) {
			var error$1;
			if (format === void 0) error$1 = /* @__PURE__ */ new Error("Minified exception occurred; use the non-minified dev environment for the full error message and additional helpful warnings.");
			else {
				var args = [
					a,
					b$1,
					c,
					d,
					e,
					f$2
				];
				var argIndex = 0;
				error$1 = new Error(format.replace(/%s/g, function() {
					return args[argIndex++];
				}));
				error$1.name = "Invariant Violation";
			}
			error$1.framesToPop = 1;
			throw error$1;
		}
	};
	module.exports = invariant$1;
}));
var require_shallowequal = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = function shallowEqual$1(objA, objB, compare, compareContext) {
		var ret = compare ? compare.call(compareContext, objA, objB) : void 0;
		if (ret !== void 0) return !!ret;
		if (objA === objB) return true;
		if (typeof objA !== "object" || !objA || typeof objB !== "object" || !objB) return false;
		var keysA = Object.keys(objA);
		var keysB = Object.keys(objB);
		if (keysA.length !== keysB.length) return false;
		var bHasOwnProperty = Object.prototype.hasOwnProperty.bind(objB);
		for (var idx = 0; idx < keysA.length; idx++) {
			var key = keysA[idx];
			if (!bHasOwnProperty(key)) return false;
			var valueA = objA[key];
			var valueB = objB[key];
			ret = compare ? compare.call(compareContext, valueA, valueB, key) : void 0;
			if (ret === false || ret === void 0 && valueA !== valueB) return false;
		}
		return true;
	};
}));
require_react_fast_compare();
require_browser();
require_shallowequal();
var TAG_NAMES = /* @__PURE__ */ ((TAG_NAMES2) => {
	TAG_NAMES2["BASE"] = "base";
	TAG_NAMES2["BODY"] = "body";
	TAG_NAMES2["HEAD"] = "head";
	TAG_NAMES2["HTML"] = "html";
	TAG_NAMES2["LINK"] = "link";
	TAG_NAMES2["META"] = "meta";
	TAG_NAMES2["NOSCRIPT"] = "noscript";
	TAG_NAMES2["SCRIPT"] = "script";
	TAG_NAMES2["STYLE"] = "style";
	TAG_NAMES2["TITLE"] = "title";
	TAG_NAMES2["FRAGMENT"] = "Symbol(react.fragment)";
	return TAG_NAMES2;
})(TAG_NAMES || {});
var SEO_PRIORITY_TAGS = {
	link: { rel: [
		"amphtml",
		"canonical",
		"alternate"
	] },
	script: { type: ["application/ld+json"] },
	meta: {
		charset: "",
		name: [
			"generator",
			"robots",
			"description"
		],
		property: [
			"og:type",
			"og:title",
			"og:url",
			"og:image",
			"og:image:alt",
			"og:description",
			"twitter:url",
			"twitter:title",
			"twitter:description",
			"twitter:image",
			"twitter:image:alt",
			"twitter:card",
			"twitter:site"
		]
	}
};
Object.values(TAG_NAMES);
var REACT_TAG_MAP = {
	accesskey: "accessKey",
	charset: "charSet",
	class: "className",
	contenteditable: "contentEditable",
	contextmenu: "contextMenu",
	"http-equiv": "httpEquiv",
	itemprop: "itemProp",
	tabindex: "tabIndex"
};
Object.entries(REACT_TAG_MAP).reduce((carry, [key, value]) => {
	carry[value] = key;
	return carry;
}, {});
var HELMET_ATTRIBUTE = "data-rh";
var flattenArray = (possibleArray) => Array.isArray(possibleArray) ? possibleArray.join("") : possibleArray;
var checkIfPropsMatch = (props, toMatch) => {
	const keys = Object.keys(props);
	for (let i = 0; i < keys.length; i += 1) if (toMatch[keys[i]] && toMatch[keys[i]].includes(props[keys[i]])) return true;
	return false;
};
var prioritizer = (elementsList, propsToMatch) => {
	if (Array.isArray(elementsList)) return elementsList.reduce((acc, elementAttrs) => {
		if (checkIfPropsMatch(elementAttrs, propsToMatch)) acc.priority.push(elementAttrs);
		else acc.default.push(elementAttrs);
		return acc;
	}, {
		priority: [],
		default: []
	});
	return {
		default: elementsList,
		priority: []
	};
};
var SELF_CLOSING_TAGS = [
	"noscript",
	"script",
	"style"
];
var encodeSpecialCharacters = (str, encode = true) => {
	if (encode === false) return String(str);
	return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
};
var generateElementAttributesAsString = (attributes) => Object.keys(attributes).reduce((str, key) => {
	const attr = typeof attributes[key] !== "undefined" ? `${key}="${attributes[key]}"` : `${key}`;
	return str ? `${str} ${attr}` : attr;
}, "");
var generateTitleAsString = (type, title, attributes, encode) => {
	const attributeString = generateElementAttributesAsString(attributes);
	const flattenedTitle = flattenArray(title);
	return attributeString ? `<${type} ${HELMET_ATTRIBUTE}="true" ${attributeString}>${encodeSpecialCharacters(flattenedTitle, encode)}</${type}>` : `<${type} ${HELMET_ATTRIBUTE}="true">${encodeSpecialCharacters(flattenedTitle, encode)}</${type}>`;
};
var generateTagsAsString = (type, tags, encode = true) => tags.reduce((str, t$2) => {
	const tag = t$2;
	const attributeHtml = Object.keys(tag).filter((attribute) => !(attribute === "innerHTML" || attribute === "cssText")).reduce((string, attribute) => {
		const attr = typeof tag[attribute] === "undefined" ? attribute : `${attribute}="${encodeSpecialCharacters(tag[attribute], encode)}"`;
		return string ? `${string} ${attr}` : attr;
	}, "");
	const tagContent = tag.innerHTML || tag.cssText || "";
	return `${str}<${type} ${HELMET_ATTRIBUTE}="true" ${attributeHtml}${SELF_CLOSING_TAGS.indexOf(type) === -1 ? `/>` : `>${tagContent}</${type}>`}`;
}, "");
var convertElementAttributesToReactProps = (attributes, initProps = {}) => Object.keys(attributes).reduce((obj, key) => {
	const mapped = REACT_TAG_MAP[key];
	obj[mapped || key] = attributes[key];
	return obj;
}, initProps);
var generateTitleAsReactComponent = (_type, title, attributes) => {
	const props = convertElementAttributesToReactProps(attributes, {
		key: title,
		[HELMET_ATTRIBUTE]: true
	});
	return [import_react.createElement("title", props, title)];
};
var generateTagsAsReactComponent = (type, tags) => tags.map((tag, i) => {
	const mappedTag = {
		key: i,
		[HELMET_ATTRIBUTE]: true
	};
	Object.keys(tag).forEach((attribute) => {
		const mappedAttribute = REACT_TAG_MAP[attribute] || attribute;
		if (mappedAttribute === "innerHTML" || mappedAttribute === "cssText") mappedTag.dangerouslySetInnerHTML = { __html: tag.innerHTML || tag.cssText };
		else mappedTag[mappedAttribute] = tag[attribute];
	});
	return import_react.createElement(type, mappedTag);
});
var getMethodsForTag = (type, tags, encode = true) => {
	switch (type) {
		case "title": return {
			toComponent: () => generateTitleAsReactComponent(type, tags.title, tags.titleAttributes),
			toString: () => generateTitleAsString(type, tags.title, tags.titleAttributes, encode)
		};
		case "bodyAttributes":
		case "htmlAttributes": return {
			toComponent: () => convertElementAttributesToReactProps(tags),
			toString: () => generateElementAttributesAsString(tags)
		};
		default: return {
			toComponent: () => generateTagsAsReactComponent(type, tags),
			toString: () => generateTagsAsString(type, tags, encode)
		};
	}
};
var getPriorityMethods = ({ metaTags, linkTags, scriptTags, encode }) => {
	const meta = prioritizer(metaTags, SEO_PRIORITY_TAGS.meta);
	const link = prioritizer(linkTags, SEO_PRIORITY_TAGS.link);
	const script = prioritizer(scriptTags, SEO_PRIORITY_TAGS.script);
	return {
		priorityMethods: {
			toComponent: () => [
				...generateTagsAsReactComponent("meta", meta.priority),
				...generateTagsAsReactComponent("link", link.priority),
				...generateTagsAsReactComponent("script", script.priority)
			],
			toString: () => `${getMethodsForTag("meta", meta.priority, encode)} ${getMethodsForTag("link", link.priority, encode)} ${getMethodsForTag("script", script.priority, encode)}`
		},
		metaTags: meta.default,
		linkTags: link.default,
		scriptTags: script.default
	};
};
var mapStateOnServer = (props) => {
	const { baseTag, bodyAttributes, encode = true, htmlAttributes, noscriptTags, styleTags, title = "", titleAttributes, prioritizeSeoTags } = props;
	let { linkTags, metaTags, scriptTags } = props;
	let priorityMethods = {
		toComponent: () => {},
		toString: () => ""
	};
	if (prioritizeSeoTags) ({priorityMethods, linkTags, metaTags, scriptTags} = getPriorityMethods(props));
	return {
		priority: priorityMethods,
		base: getMethodsForTag("base", baseTag, encode),
		bodyAttributes: getMethodsForTag("bodyAttributes", bodyAttributes, encode),
		htmlAttributes: getMethodsForTag("htmlAttributes", htmlAttributes, encode),
		link: getMethodsForTag("link", linkTags, encode),
		meta: getMethodsForTag("meta", metaTags, encode),
		noscript: getMethodsForTag("noscript", noscriptTags, encode),
		script: getMethodsForTag("script", scriptTags, encode),
		style: getMethodsForTag("style", styleTags, encode),
		title: getMethodsForTag("title", {
			title,
			titleAttributes
		}, encode)
	};
};
var server_default = mapStateOnServer;
var instances = [];
var isDocument = !!(typeof window !== "undefined" && window.document && window.document.createElement);
var HelmetData = class {
	instances = [];
	canUseDOM = isDocument;
	context;
	value = {
		setHelmet: (serverState) => {
			this.context.helmet = serverState;
		},
		helmetInstances: {
			get: () => this.canUseDOM ? instances : this.instances,
			add: (instance) => {
				(this.canUseDOM ? instances : this.instances).push(instance);
			},
			remove: (instance) => {
				const index$1 = (this.canUseDOM ? instances : this.instances).indexOf(instance);
				(this.canUseDOM ? instances : this.instances).splice(index$1, 1);
			}
		}
	};
	constructor(context, canUseDOM$1) {
		this.context = context;
		this.canUseDOM = canUseDOM$1 || false;
		if (!canUseDOM$1) context.helmet = server_default({
			baseTag: [],
			bodyAttributes: {},
			encodeSpecialCharacters: true,
			htmlAttributes: {},
			linkTags: [],
			metaTags: [],
			noscriptTags: [],
			scriptTags: [],
			styleTags: [],
			title: "",
			titleAttributes: {}
		});
	}
};
var Context = import_react.createContext({});
var HelmetProvider = class _HelmetProvider extends import_react.Component {
	static canUseDOM = isDocument;
	helmetData;
	constructor(props) {
		super(props);
		this.helmetData = new HelmetData(this.props.context || {}, _HelmetProvider.canUseDOM);
	}
	render() {
		return /* @__PURE__ */ import_react.createElement(Context.Provider, { value: this.helmetData.value }, this.props.children);
	}
};
var __defProp$15 = Object.defineProperty;
var __name$15 = (target, value) => __defProp$15(target, "name", {
	value,
	configurable: true
});
var canUseDOM = !!(typeof window !== "undefined" && window.document && window.document.createElement);
function composeEventHandlers(originalEventHandler, ourEventHandler, { checkForDefaultPrevented = true } = {}) {
	return /* @__PURE__ */ __name$15(function handleEvent(event) {
		originalEventHandler?.(event);
		if (checkForDefaultPrevented === false || !event || !event.defaultPrevented) return ourEventHandler?.(event);
	}, "handleEvent");
}
__name$15(composeEventHandlers, "composeEventHandlers");
function getOwnerWindow(element) {
	if (!canUseDOM) throw new Error("Cannot access window outside of the DOM");
	return element?.ownerDocument?.defaultView ?? window;
}
__name$15(getOwnerWindow, "getOwnerWindow");
function getOwnerDocument(element) {
	if (!canUseDOM) throw new Error("Cannot access document outside of the DOM");
	return element?.ownerDocument ?? document;
}
__name$15(getOwnerDocument, "getOwnerDocument");
function getActiveElement(node, activeDescendant = false) {
	const { activeElement } = getOwnerDocument(node);
	if (!activeElement?.nodeName) return null;
	if (isFrame(activeElement) && activeElement.contentDocument) return getActiveElement(activeElement.contentDocument.body, activeDescendant);
	if (activeDescendant) {
		const id$1 = activeElement.getAttribute("aria-activedescendant");
		if (id$1) {
			const element = getOwnerDocument(activeElement).getElementById(id$1);
			if (element) return element;
		}
	}
	return activeElement;
}
__name$15(getActiveElement, "getActiveElement");
function isFrame(element) {
	return element.tagName === "IFRAME";
}
__name$15(isFrame, "isFrame");
var __defProp$14 = Object.defineProperty;
var __name$14 = (target, value) => __defProp$14(target, "name", {
	value,
	configurable: true
});
function setRef$1(ref, value) {
	if (typeof ref === "function") return ref(value);
	else if (ref !== null && ref !== void 0) ref.current = value;
}
__name$14(setRef$1, "setRef");
function composeRefs(...refs) {
	return (node) => {
		let hasCleanup = false;
		const cleanups = refs.map((ref) => {
			const cleanup = setRef$1(ref, node);
			if (!hasCleanup && typeof cleanup == "function") hasCleanup = true;
			return cleanup;
		});
		if (hasCleanup) return () => {
			for (let i = 0; i < cleanups.length; i++) {
				const cleanup = cleanups[i];
				if (typeof cleanup == "function") cleanup();
				else setRef$1(refs[i], null);
			}
		};
	};
}
__name$14(composeRefs, "composeRefs");
function useComposedRefs(...refs) {
	return import_react.useCallback(composeRefs(...refs), refs);
}
__name$14(useComposedRefs, "useComposedRefs");
var __defProp$13 = Object.defineProperty;
var __name$13 = (target, value) => __defProp$13(target, "name", {
	value,
	configurable: true
});
/* @__NO_SIDE_EFFECTS__ */
function createContext2(rootComponentName, defaultContext) {
	const Context$1 = import_react.createContext(defaultContext);
	Context$1.displayName = rootComponentName + "Context";
	const Provider$1 = /* @__PURE__ */ __name$13((props) => {
		const { children, ...context } = props;
		const value = import_react.useMemo(() => context, Object.values(context));
		return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Context$1.Provider, {
			value,
			children
		});
	}, "Provider");
	Provider$1.displayName = rootComponentName + "Provider";
	function useContext2(consumerName, options = {}) {
		const { optional = false } = options;
		const context = import_react.useContext(Context$1);
		if (context) return context;
		if (defaultContext !== void 0) return defaultContext;
		if (optional) return void 0;
		throw new Error(`\`${consumerName}\` must be used within \`${rootComponentName}\``);
	}
	__name$13(useContext2, "useContext");
	return [Provider$1, useContext2];
}
__name$13(createContext2, "createContext");
/* @__NO_SIDE_EFFECTS__ */
function createContextScope(scopeName, createContextScopeDeps = []) {
	let defaultContexts = [];
	function createContext3(rootComponentName, defaultContext) {
		const BaseContext = import_react.createContext(defaultContext);
		BaseContext.displayName = rootComponentName + "Context";
		const index$1 = defaultContexts.length;
		defaultContexts = [...defaultContexts, defaultContext];
		const Provider$1 = /* @__PURE__ */ __name$13((props) => {
			const { scope, children, ...context } = props;
			const Context$1 = scope?.[scopeName]?.[index$1] || BaseContext;
			const value = import_react.useMemo(() => context, Object.values(context));
			return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Context$1.Provider, {
				value,
				children
			});
		}, "Provider");
		Provider$1.displayName = rootComponentName + "Provider";
		function useContext2(consumerName, scope, options = {}) {
			const { optional = false } = options;
			const Context$1 = scope?.[scopeName]?.[index$1] || BaseContext;
			const context = import_react.useContext(Context$1);
			if (context) return context;
			if (defaultContext !== void 0) return defaultContext;
			if (optional) return void 0;
			throw new Error(`\`${consumerName}\` must be used within \`${rootComponentName}\``);
		}
		__name$13(useContext2, "useContext");
		return [Provider$1, useContext2];
	}
	__name$13(createContext3, "createContext");
	const createScope = /* @__PURE__ */ __name$13(() => {
		const scopeContexts = defaultContexts.map((defaultContext) => {
			return import_react.createContext(defaultContext);
		});
		return /* @__PURE__ */ __name$13(function useScope(scope) {
			const contexts = scope?.[scopeName] || scopeContexts;
			return import_react.useMemo(() => ({ [`__scope${scopeName}`]: {
				...scope,
				[scopeName]: contexts
			} }), [scope, contexts]);
		}, "useScope");
	}, "createScope");
	createScope.scopeName = scopeName;
	return [createContext3, composeContextScopes(createScope, ...createContextScopeDeps)];
}
__name$13(createContextScope, "createContextScope");
function composeContextScopes(...scopes) {
	const baseScope = scopes[0];
	if (scopes.length === 1) return baseScope;
	const createScope = /* @__PURE__ */ __name$13(() => {
		const scopeHooks = scopes.map((createScope2) => ({
			useScope: createScope2(),
			scopeName: createScope2.scopeName
		}));
		return /* @__PURE__ */ __name$13(function useComposedScopes(overrideScopes) {
			const nextScopes = scopeHooks.reduce((nextScopes2, { useScope, scopeName }) => {
				const currentScope = useScope(overrideScopes)[`__scope${scopeName}`];
				return {
					...nextScopes2,
					...currentScope
				};
			}, {});
			return import_react.useMemo(() => ({ [`__scope${baseScope.scopeName}`]: nextScopes }), [nextScopes]);
		}, "useComposedScopes");
	}, "createScope");
	createScope.scopeName = baseScope.scopeName;
	return createScope;
}
__name$13(composeContextScopes, "composeContextScopes");
var __defProp$12 = Object.defineProperty;
var __name$12 = (target, value) => __defProp$12(target, "name", {
	value,
	configurable: true
});
/* @__NO_SIDE_EFFECTS__ */
function createSlot(ownerName) {
	const Slot2 = import_react.forwardRef((props, forwardedRef) => {
		let { children, ...slotProps } = props;
		let slottableElement = null;
		let hasSlottable = false;
		const newChildren = [];
		if (isLazyComponent(children) && typeof use === "function") children = use(children._payload);
		import_react.Children.forEach(children, (maybeSlottable) => {
			if (isSlottable(maybeSlottable)) {
				hasSlottable = true;
				const slottable = maybeSlottable;
				let child = "child" in slottable.props ? slottable.props.child : slottable.props.children;
				if (isLazyComponent(child) && typeof use === "function") child = use(child._payload);
				slottableElement = getSlottableElementFromSlottable(slottable, child);
				newChildren.push(slottableElement?.props?.children);
			} else newChildren.push(maybeSlottable);
		});
		if (slottableElement) slottableElement = import_react.cloneElement(slottableElement, void 0, newChildren);
		else if (!hasSlottable && import_react.Children.count(children) === 1 && import_react.isValidElement(children)) slottableElement = children;
		const slottableElementRef = slottableElement ? getElementRef$1(slottableElement) : void 0;
		const composedRef = useComposedRefs(forwardedRef, slottableElementRef);
		if (!slottableElement) {
			if (children || children === 0) throw new Error(hasSlottable ? createSlottableError(ownerName) : createSlotError(ownerName));
			return children;
		}
		const mergedProps = mergeProps(slotProps, slottableElement.props ?? {});
		if (slottableElement.type !== import_react.Fragment) mergedProps.ref = forwardedRef ? composedRef : slottableElementRef;
		return import_react.cloneElement(slottableElement, mergedProps);
	});
	Slot2.displayName = `${ownerName}.Slot`;
	return Slot2;
}
__name$12(createSlot, "createSlot");
var SLOTTABLE_IDENTIFIER = Symbol.for("radix.slottable");
/* @__NO_SIDE_EFFECTS__ */
function createSlottable(ownerName) {
	const Slottable2 = /* @__PURE__ */ __name$12((props) => "child" in props ? props.children(props.child) : props.children, "Slottable");
	Slottable2.displayName = `${ownerName}.Slottable`;
	Slottable2.__radixId = SLOTTABLE_IDENTIFIER;
	return Slottable2;
}
__name$12(createSlottable, "createSlottable");
var getSlottableElementFromSlottable = /* @__PURE__ */ __name$12((slottable, child) => {
	if ("child" in slottable.props) {
		const child2 = slottable.props.child;
		if (!import_react.isValidElement(child2)) return null;
		return import_react.cloneElement(child2, void 0, slottable.props.children(child2.props.children));
	}
	return import_react.isValidElement(child) ? child : null;
}, "getSlottableElementFromSlottable");
function mergeProps(slotProps, childProps) {
	const overrideProps = { ...childProps };
	for (const propName in childProps) {
		const slotPropValue = slotProps[propName];
		const childPropValue = childProps[propName];
		if (/^on[A-Z]/.test(propName)) {
			if (slotPropValue && childPropValue) overrideProps[propName] = (...args) => {
				const result = childPropValue(...args);
				slotPropValue(...args);
				return result;
			};
			else if (slotPropValue) overrideProps[propName] = slotPropValue;
		} else if (propName === "style") overrideProps[propName] = {
			...slotPropValue,
			...childPropValue
		};
		else if (propName === "className") overrideProps[propName] = [slotPropValue, childPropValue].filter(Boolean).join(" ");
	}
	return {
		...slotProps,
		...overrideProps
	};
}
__name$12(mergeProps, "mergeProps");
function getElementRef$1(element) {
	let getter = Object.getOwnPropertyDescriptor(element.props, "ref")?.get;
	let mayWarn = getter && "isReactWarning" in getter && getter.isReactWarning;
	if (mayWarn) return element.ref;
	getter = Object.getOwnPropertyDescriptor(element, "ref")?.get;
	mayWarn = getter && "isReactWarning" in getter && getter.isReactWarning;
	if (mayWarn) return element.props.ref;
	return element.props.ref || element.ref;
}
__name$12(getElementRef$1, "getElementRef");
function isSlottable(child) {
	return import_react.isValidElement(child) && typeof child.type === "function" && "__radixId" in child.type && child.type.__radixId === SLOTTABLE_IDENTIFIER;
}
__name$12(isSlottable, "isSlottable");
var REACT_LAZY_TYPE = Symbol.for("react.lazy");
function isLazyComponent(element) {
	return element != null && typeof element === "object" && "$$typeof" in element && element.$$typeof === REACT_LAZY_TYPE && "_payload" in element && isPromiseLike(element._payload);
}
__name$12(isLazyComponent, "isLazyComponent");
function isPromiseLike(value) {
	return typeof value === "object" && value !== null && "then" in value;
}
__name$12(isPromiseLike, "isPromiseLike");
var createSlotError = /* @__PURE__ */ __name$12((ownerName) => {
	return `${ownerName} failed to slot onto its children. Expected a single React element child or \`Slottable\`.`;
}, "createSlotError");
var createSlottableError = /* @__PURE__ */ __name$12((ownerName) => {
	return `${ownerName} failed to slot onto its \`Slottable\`. Expected \`Slottable\` to receive a single React element child.`;
}, "createSlottableError");
var use = import_react[" use ".trim().toString()];
var import_react_dom$2 = /* @__PURE__ */ __toESM(require_react_dom(), 1);
var __defProp$11 = Object.defineProperty;
var __name$11 = (target, value) => __defProp$11(target, "name", {
	value,
	configurable: true
});
var Primitive = [
	"a",
	"button",
	"div",
	"form",
	"h2",
	"h3",
	"img",
	"input",
	"label",
	"li",
	"nav",
	"ol",
	"p",
	"select",
	"span",
	"svg",
	"ul"
].reduce((primitive, node) => {
	const Slot = /* @__PURE__ */ createSlot(`Primitive.${node}`);
	const Node$1 = import_react.forwardRef((props, forwardedRef) => {
		const { asChild, ...primitiveProps } = props;
		const Comp = asChild ? Slot : node;
		if (typeof window !== "undefined") window[Symbol.for("radix-ui")] = true;
		return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Comp, {
			...primitiveProps,
			ref: forwardedRef
		});
	});
	Node$1.displayName = `Primitive.${node}`;
	return {
		...primitive,
		[node]: Node$1
	};
}, {});
function dispatchDiscreteCustomEvent(target, event) {
	if (target) import_react_dom$2.flushSync(() => target.dispatchEvent(event));
}
__name$11(dispatchDiscreteCustomEvent, "dispatchDiscreteCustomEvent");
var __defProp$10 = Object.defineProperty;
var __name$10 = (target, value) => __defProp$10(target, "name", {
	value,
	configurable: true
});
function useCallbackRef(callback) {
	const callbackRef = import_react.useRef(callback);
	import_react.useEffect(() => {
		callbackRef.current = callback;
	});
	return import_react.useMemo(() => ((...args) => callbackRef.current?.(...args)), []);
}
__name$10(useCallbackRef, "useCallbackRef");
var __defProp$9 = Object.defineProperty;
var __name$9 = (target, value) => __defProp$9(target, "name", {
	value,
	configurable: true
});
var CONTEXT_UPDATE = "dismissableLayer.update";
var POINTER_DOWN_OUTSIDE = "dismissableLayer.pointerDownOutside";
var FOCUS_OUTSIDE = "dismissableLayer.focusOutside";
var originalBodyPointerEvents;
var DismissableLayerContext = import_react.createContext({
	layers: /* @__PURE__ */ new Set(),
	layersWithOutsidePointerEventsDisabled: /* @__PURE__ */ new Set(),
	branches: /* @__PURE__ */ new Set(),
	dismissableSurfaces: /* @__PURE__ */ new Set()
});
var DismissableLayer = /* @__PURE__ */ import_react.forwardRef(/* @__PURE__ */ __name$9(function DismissableLayer2(props, forwardedRef) {
	const { disableOutsidePointerEvents = false, deferPointerDownOutside = false, onEscapeKeyDown, onPointerDownOutside, onFocusOutside, onInteractOutside, onDismiss, ...layerProps } = props;
	const context = import_react.useContext(DismissableLayerContext);
	const [node, setNode] = import_react.useState(null);
	const ownerDocument = node?.ownerDocument ?? globalThis?.document;
	const [, force] = import_react.useState({});
	const composedRefs = useComposedRefs(forwardedRef, setNode);
	const layers = Array.from(context.layers);
	const [highestLayerWithOutsidePointerEventsDisabled] = [...context.layersWithOutsidePointerEventsDisabled].slice(-1);
	const highestLayerWithOutsidePointerEventsDisabledIndex = highestLayerWithOutsidePointerEventsDisabled ? layers.indexOf(highestLayerWithOutsidePointerEventsDisabled) : -1;
	const index$1 = node ? layers.indexOf(node) : -1;
	const isBodyPointerEventsDisabled = context.layersWithOutsidePointerEventsDisabled.size > 0;
	const isPointerEventsEnabled = index$1 >= highestLayerWithOutsidePointerEventsDisabledIndex;
	const isDeferredPointerDownOutsideRef = import_react.useRef(false);
	const pointerDownOutside = usePointerDownOutside((event) => {
		onPointerDownOutside?.(event);
		onInteractOutside?.(event);
		if (!event.defaultPrevented) onDismiss?.();
	}, {
		ownerDocument,
		deferPointerDownOutside,
		isDeferredPointerDownOutsideRef,
		dismissableSurfaces: context.dismissableSurfaces,
		shouldHandlePointerDownOutside: import_react.useCallback((target) => {
			if (!(target instanceof Node)) return false;
			const isPointerDownOnBranch = [...context.branches].some((branch) => branch.contains(target));
			return isPointerEventsEnabled && !isPointerDownOnBranch;
		}, [context.branches, isPointerEventsEnabled])
	});
	const focusOutside = useFocusOutside((event) => {
		if (deferPointerDownOutside && isDeferredPointerDownOutsideRef.current) return;
		const target = event.target;
		if ([...context.branches].some((branch) => branch.contains(target))) return;
		onFocusOutside?.(event);
		onInteractOutside?.(event);
		if (!event.defaultPrevented) onDismiss?.();
	}, ownerDocument);
	const isHighestLayer = node ? index$1 === layers.length - 1 : false;
	const handleKeyDown = useCallbackRef((event) => {
		if (event.key !== "Escape") return;
		onEscapeKeyDown?.(event);
		if (!event.defaultPrevented && onDismiss) {
			event.preventDefault();
			onDismiss();
		}
	});
	import_react.useEffect(() => {
		if (!isHighestLayer) return;
		ownerDocument.addEventListener("keydown", handleKeyDown, { capture: true });
		return () => ownerDocument.removeEventListener("keydown", handleKeyDown, { capture: true });
	}, [
		ownerDocument,
		isHighestLayer,
		handleKeyDown
	]);
	import_react.useEffect(() => {
		if (!node) return;
		if (disableOutsidePointerEvents) {
			if (context.layersWithOutsidePointerEventsDisabled.size === 0) {
				originalBodyPointerEvents = ownerDocument.body.style.pointerEvents;
				ownerDocument.body.style.pointerEvents = "none";
			}
			context.layersWithOutsidePointerEventsDisabled.add(node);
		}
		context.layers.add(node);
		dispatchUpdate();
		return () => {
			if (disableOutsidePointerEvents) {
				context.layersWithOutsidePointerEventsDisabled.delete(node);
				if (context.layersWithOutsidePointerEventsDisabled.size === 0) ownerDocument.body.style.pointerEvents = originalBodyPointerEvents;
			}
		};
	}, [
		node,
		ownerDocument,
		disableOutsidePointerEvents,
		context
	]);
	import_react.useEffect(() => {
		return () => {
			if (!node) return;
			context.layers.delete(node);
			context.layersWithOutsidePointerEventsDisabled.delete(node);
			dispatchUpdate();
		};
	}, [node, context]);
	import_react.useEffect(() => {
		const handleUpdate = /* @__PURE__ */ __name$9(() => force({}), "handleUpdate");
		document.addEventListener(CONTEXT_UPDATE, handleUpdate);
		return () => document.removeEventListener(CONTEXT_UPDATE, handleUpdate);
	}, []);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Primitive.div, {
		...layerProps,
		ref: composedRefs,
		style: {
			pointerEvents: isBodyPointerEventsDisabled ? isPointerEventsEnabled ? "auto" : "none" : void 0,
			...props.style
		},
		onFocusCapture: composeEventHandlers(props.onFocusCapture, focusOutside.onFocusCapture),
		onBlurCapture: composeEventHandlers(props.onBlurCapture, focusOutside.onBlurCapture),
		onPointerDownCapture: composeEventHandlers(props.onPointerDownCapture, pointerDownOutside.onPointerDownCapture)
	});
}, "DismissableLayer"));
function useDismissableLayerSurface() {
	const context = import_react.useContext(DismissableLayerContext);
	const [node, setNode] = import_react.useState(null);
	import_react.useEffect(() => {
		if (!node) return;
		context.dismissableSurfaces.add(node);
		return () => {
			context.dismissableSurfaces.delete(node);
		};
	}, [node, context.dismissableSurfaces]);
	return setNode;
}
__name$9(useDismissableLayerSurface, "useDismissableLayerSurface");
var IS_TRUE = /* @__PURE__ */ __name$9(() => true, "IS_TRUE");
function usePointerDownOutside(onPointerDownOutside, args) {
	const { ownerDocument = globalThis?.document, deferPointerDownOutside = false, isDeferredPointerDownOutsideRef, dismissableSurfaces, shouldHandlePointerDownOutside = IS_TRUE } = args;
	const handlePointerDownOutside = useCallbackRef(onPointerDownOutside);
	const isPointerInsideReactTreeRef = import_react.useRef(false);
	const isPointerDownOutsideRef = import_react.useRef(false);
	const interceptedOutsideInteractionEventsRef = import_react.useRef(/* @__PURE__ */ new Map());
	const handleClickRef = import_react.useRef(() => {});
	import_react.useEffect(() => {
		function resetOutsideInteraction() {
			isPointerDownOutsideRef.current = false;
			isDeferredPointerDownOutsideRef.current = false;
			interceptedOutsideInteractionEventsRef.current.clear();
		}
		__name$9(resetOutsideInteraction, "resetOutsideInteraction");
		function isOutsideInteractionIntercepted() {
			return Array.from(interceptedOutsideInteractionEventsRef.current.values()).some(Boolean);
		}
		__name$9(isOutsideInteractionIntercepted, "isOutsideInteractionIntercepted");
		function handleInteractionCapture(event) {
			if (!isPointerDownOutsideRef.current) return;
			const target = event.target;
			if (!(target instanceof Node && [...dismissableSurfaces].some((surface) => surface.contains(target)))) interceptedOutsideInteractionEventsRef.current.set(event.type, true);
			if (event.type === "click") window.setTimeout(() => {
				if (isPointerDownOutsideRef.current) handleClickRef.current();
			}, 0);
		}
		__name$9(handleInteractionCapture, "handleInteractionCapture");
		function handleInteractionBubble(event) {
			if (isPointerDownOutsideRef.current) interceptedOutsideInteractionEventsRef.current.set(event.type, false);
		}
		__name$9(handleInteractionBubble, "handleInteractionBubble");
		const handlePointerDown = /* @__PURE__ */ __name$9((event) => {
			if (event.target && !isPointerInsideReactTreeRef.current) {
				let handleAndDispatchPointerDownOutsideEvent2 = function() {
					ownerDocument.removeEventListener("click", handleClickRef.current);
					const wasOutsideInteractionIntercepted = isOutsideInteractionIntercepted();
					resetOutsideInteraction();
					if (!wasOutsideInteractionIntercepted) handleAndDispatchCustomEvent(POINTER_DOWN_OUTSIDE, handlePointerDownOutside, eventDetail, { discrete: true });
				};
				__name$9(handleAndDispatchPointerDownOutsideEvent2, "handleAndDispatchPointerDownOutsideEvent");
				if (!shouldHandlePointerDownOutside(event.target)) {
					ownerDocument.removeEventListener("click", handleClickRef.current);
					resetOutsideInteraction();
					isPointerInsideReactTreeRef.current = false;
					return;
				}
				const eventDetail = { originalEvent: event };
				isPointerDownOutsideRef.current = true;
				isDeferredPointerDownOutsideRef.current = deferPointerDownOutside && event.button === 0;
				interceptedOutsideInteractionEventsRef.current.clear();
				if (!deferPointerDownOutside || event.button !== 0) handleAndDispatchPointerDownOutsideEvent2();
				else {
					ownerDocument.removeEventListener("click", handleClickRef.current);
					handleClickRef.current = handleAndDispatchPointerDownOutsideEvent2;
					ownerDocument.addEventListener("click", handleClickRef.current, { once: true });
				}
			} else {
				ownerDocument.removeEventListener("click", handleClickRef.current);
				resetOutsideInteraction();
			}
			isPointerInsideReactTreeRef.current = false;
		}, "handlePointerDown");
		const outsideInteractionEvents = [
			"pointerup",
			"mousedown",
			"mouseup",
			"touchstart",
			"touchend",
			"click"
		];
		for (const eventName of outsideInteractionEvents) {
			ownerDocument.addEventListener(eventName, handleInteractionCapture, true);
			ownerDocument.addEventListener(eventName, handleInteractionBubble);
		}
		const timerId = window.setTimeout(() => {
			ownerDocument.addEventListener("pointerdown", handlePointerDown);
		}, 0);
		return () => {
			window.clearTimeout(timerId);
			ownerDocument.removeEventListener("pointerdown", handlePointerDown);
			ownerDocument.removeEventListener("click", handleClickRef.current);
			for (const eventName of outsideInteractionEvents) {
				ownerDocument.removeEventListener(eventName, handleInteractionCapture, true);
				ownerDocument.removeEventListener(eventName, handleInteractionBubble);
			}
		};
	}, [
		ownerDocument,
		handlePointerDownOutside,
		deferPointerDownOutside,
		isDeferredPointerDownOutsideRef,
		dismissableSurfaces,
		shouldHandlePointerDownOutside
	]);
	return { onPointerDownCapture: /* @__PURE__ */ __name$9(() => isPointerInsideReactTreeRef.current = true, "onPointerDownCapture") };
}
__name$9(usePointerDownOutside, "usePointerDownOutside");
function useFocusOutside(onFocusOutside, ownerDocument = globalThis?.document) {
	const handleFocusOutside = useCallbackRef(onFocusOutside);
	const isFocusInsideReactTreeRef = import_react.useRef(false);
	import_react.useEffect(() => {
		const handleFocus = /* @__PURE__ */ __name$9((event) => {
			if (event.target && !isFocusInsideReactTreeRef.current) handleAndDispatchCustomEvent(FOCUS_OUTSIDE, handleFocusOutside, { originalEvent: event }, { discrete: false });
		}, "handleFocus");
		ownerDocument.addEventListener("focusin", handleFocus);
		return () => ownerDocument.removeEventListener("focusin", handleFocus);
	}, [ownerDocument, handleFocusOutside]);
	return {
		onFocusCapture: /* @__PURE__ */ __name$9(() => isFocusInsideReactTreeRef.current = true, "onFocusCapture"),
		onBlurCapture: /* @__PURE__ */ __name$9(() => isFocusInsideReactTreeRef.current = false, "onBlurCapture")
	};
}
__name$9(useFocusOutside, "useFocusOutside");
function dispatchUpdate() {
	const event = new CustomEvent(CONTEXT_UPDATE);
	document.dispatchEvent(event);
}
__name$9(dispatchUpdate, "dispatchUpdate");
function handleAndDispatchCustomEvent(name, handler, detail, { discrete }) {
	const target = detail.originalEvent.target;
	const event = new CustomEvent(name, {
		bubbles: false,
		cancelable: true,
		detail
	});
	if (handler) target.addEventListener(name, handler, { once: true });
	if (discrete) dispatchDiscreteCustomEvent(target, event);
	else target.dispatchEvent(event);
}
__name$9(handleAndDispatchCustomEvent, "handleAndDispatchCustomEvent");
var useLayoutEffect2 = globalThis?.document ? import_react.useLayoutEffect : () => {};
var __defProp$8 = Object.defineProperty;
var __name$8 = (target, value) => __defProp$8(target, "name", {
	value,
	configurable: true
});
var useReactId = import_react[" useId ".trim().toString()] || (() => void 0);
var count = 0;
function useId(deterministicId) {
	const [id$1, setId] = import_react.useState(useReactId());
	useLayoutEffect2(() => {
		if (!deterministicId) setId((reactId) => reactId ?? String(count++));
	}, [deterministicId]);
	return deterministicId || (id$1 ? `radix-${id$1}` : "");
}
__name$8(useId, "useId");
var sides = [
	"top",
	"right",
	"bottom",
	"left"
];
var min = Math.min;
var max = Math.max;
var round = Math.round;
var floor = Math.floor;
var createCoords = (v$3) => ({
	x: v$3,
	y: v$3
});
var oppositeSideMap = {
	left: "right",
	right: "left",
	bottom: "top",
	top: "bottom"
};
function clamp(start, value, end) {
	return max(start, min(value, end));
}
function evaluate(value, param) {
	return typeof value === "function" ? value(param) : value;
}
function getSide(placement) {
	return placement.split("-")[0];
}
function getAlignment(placement) {
	return placement.split("-")[1];
}
function getOppositeAxis(axis) {
	return axis === "x" ? "y" : "x";
}
function getAxisLength(axis) {
	return axis === "y" ? "height" : "width";
}
function getSideAxis(placement) {
	const firstChar = placement[0];
	return firstChar === "t" || firstChar === "b" ? "y" : "x";
}
function getAlignmentAxis(placement) {
	return getOppositeAxis(getSideAxis(placement));
}
function getAlignmentSides(placement, rects, rtl) {
	if (rtl === void 0) rtl = false;
	const alignment = getAlignment(placement);
	const alignmentAxis = getAlignmentAxis(placement);
	const length = getAxisLength(alignmentAxis);
	let mainAlignmentSide = alignmentAxis === "x" ? alignment === (rtl ? "end" : "start") ? "right" : "left" : alignment === "start" ? "bottom" : "top";
	if (rects.reference[length] > rects.floating[length]) mainAlignmentSide = getOppositePlacement(mainAlignmentSide);
	return [mainAlignmentSide, getOppositePlacement(mainAlignmentSide)];
}
function getExpandedPlacements(placement) {
	const oppositePlacement = getOppositePlacement(placement);
	return [
		getOppositeAlignmentPlacement(placement),
		oppositePlacement,
		getOppositeAlignmentPlacement(oppositePlacement)
	];
}
function getOppositeAlignmentPlacement(placement) {
	return placement.includes("start") ? placement.replace("start", "end") : placement.replace("end", "start");
}
var lrPlacement = ["left", "right"];
var rlPlacement = ["right", "left"];
var tbPlacement = ["top", "bottom"];
var btPlacement = ["bottom", "top"];
function getSideList(side, isStart, rtl) {
	switch (side) {
		case "top":
		case "bottom":
			if (rtl) return isStart ? rlPlacement : lrPlacement;
			return isStart ? lrPlacement : rlPlacement;
		case "left":
		case "right": return isStart ? tbPlacement : btPlacement;
		default: return [];
	}
}
function getOppositeAxisPlacements(placement, flipAlignment, direction, rtl) {
	const alignment = getAlignment(placement);
	let list = getSideList(getSide(placement), direction === "start", rtl);
	if (alignment) {
		list = list.map((side) => side + "-" + alignment);
		if (flipAlignment) list = list.concat(list.map(getOppositeAlignmentPlacement));
	}
	return list;
}
function getOppositePlacement(placement) {
	const side = getSide(placement);
	return oppositeSideMap[side] + placement.slice(side.length);
}
function expandPaddingObject(padding) {
	var _padding$top, _padding$right, _padding$bottom, _padding$left;
	return {
		top: (_padding$top = padding.top) != null ? _padding$top : 0,
		right: (_padding$right = padding.right) != null ? _padding$right : 0,
		bottom: (_padding$bottom = padding.bottom) != null ? _padding$bottom : 0,
		left: (_padding$left = padding.left) != null ? _padding$left : 0
	};
}
function getPaddingObject(padding) {
	return typeof padding !== "number" ? expandPaddingObject(padding) : {
		top: padding,
		right: padding,
		bottom: padding,
		left: padding
	};
}
function rectToClientRect(rect) {
	const { x: x$2, y: y$2, width, height } = rect;
	return {
		width,
		height,
		top: y$2,
		left: x$2,
		right: x$2 + width,
		bottom: y$2 + height,
		x: x$2,
		y: y$2
	};
}
function computeCoordsFromPlacement(_ref, placement, rtl) {
	let { reference, floating } = _ref;
	const sideAxis = getSideAxis(placement);
	const alignmentAxis = getAlignmentAxis(placement);
	const alignLength = getAxisLength(alignmentAxis);
	const side = getSide(placement);
	const isVertical = sideAxis === "y";
	const commonX = reference.x + reference.width / 2 - floating.width / 2;
	const commonY = reference.y + reference.height / 2 - floating.height / 2;
	const commonAlign = reference[alignLength] / 2 - floating[alignLength] / 2;
	let coords;
	switch (side) {
		case "top":
			coords = {
				x: commonX,
				y: reference.y - floating.height
			};
			break;
		case "bottom":
			coords = {
				x: commonX,
				y: reference.y + reference.height
			};
			break;
		case "right":
			coords = {
				x: reference.x + reference.width,
				y: commonY
			};
			break;
		case "left":
			coords = {
				x: reference.x - floating.width,
				y: commonY
			};
			break;
		default: coords = {
			x: reference.x,
			y: reference.y
		};
	}
	const alignment = getAlignment(placement);
	if (alignment) coords[alignmentAxis] += commonAlign * (alignment === "end" ? 1 : -1) * (rtl && isVertical ? -1 : 1);
	return coords;
}
async function detectOverflow$1(state, options) {
	var _await$platform$isEle;
	if (options === void 0) options = {};
	const { x: x$2, y: y$2, platform: platform$1, rects, elements, strategy } = state;
	const { boundary = "clippingAncestors", rootBoundary = "viewport", elementContext = "floating", altBoundary = false, padding = 0 } = evaluate(options, state);
	const paddingObject = getPaddingObject(padding);
	const element = elements[altBoundary ? elementContext === "floating" ? "reference" : "floating" : elementContext];
	const clippingClientRect = rectToClientRect(await platform$1.getClippingRect({
		element: ((_await$platform$isEle = await (platform$1.isElement == null ? void 0 : platform$1.isElement(element))) != null ? _await$platform$isEle : true) ? element : element.contextElement || await (platform$1.getDocumentElement == null ? void 0 : platform$1.getDocumentElement(elements.floating)),
		boundary,
		rootBoundary,
		strategy
	}));
	const rect = elementContext === "floating" ? {
		x: x$2,
		y: y$2,
		width: rects.floating.width,
		height: rects.floating.height
	} : rects.reference;
	const offsetParent = await (platform$1.getOffsetParent == null ? void 0 : platform$1.getOffsetParent(elements.floating));
	const offsetScale = await (platform$1.isElement == null ? void 0 : platform$1.isElement(offsetParent)) && await (platform$1.getScale == null ? void 0 : platform$1.getScale(offsetParent)) || {
		x: 1,
		y: 1
	};
	const elementClientRect = rectToClientRect(platform$1.convertOffsetParentRelativeRectToViewportRelativeRect ? await platform$1.convertOffsetParentRelativeRectToViewportRelativeRect({
		elements,
		rect,
		offsetParent,
		strategy
	}) : rect);
	return {
		top: (clippingClientRect.top - elementClientRect.top + paddingObject.top) / offsetScale.y,
		bottom: (elementClientRect.bottom - clippingClientRect.bottom + paddingObject.bottom) / offsetScale.y,
		left: (clippingClientRect.left - elementClientRect.left + paddingObject.left) / offsetScale.x,
		right: (elementClientRect.right - clippingClientRect.right + paddingObject.right) / offsetScale.x
	};
}
var MAX_RESET_COUNT = 50;
var computePosition$1 = async (reference, floating, config) => {
	const { placement = "bottom", strategy = "absolute", middleware = [], platform: platform$1 } = config;
	const platformWithDetectOverflow = platform$1.detectOverflow ? platform$1 : {
		...platform$1,
		detectOverflow: detectOverflow$1
	};
	const rtl = await (platform$1.isRTL == null ? void 0 : platform$1.isRTL(floating));
	let rects = await platform$1.getElementRects({
		reference,
		floating,
		strategy
	});
	let { x: x$2, y: y$2 } = computeCoordsFromPlacement(rects, placement, rtl);
	let statefulPlacement = placement;
	let resetCount = 0;
	const middlewareData = {};
	for (let i = 0; i < middleware.length; i++) {
		const currentMiddleware = middleware[i];
		if (!currentMiddleware) continue;
		const { name, fn } = currentMiddleware;
		const { x: nextX, y: nextY, data, reset } = await fn({
			x: x$2,
			y: y$2,
			initialPlacement: placement,
			placement: statefulPlacement,
			strategy,
			middlewareData,
			rects,
			platform: platformWithDetectOverflow,
			elements: {
				reference,
				floating
			}
		});
		x$2 = nextX != null ? nextX : x$2;
		y$2 = nextY != null ? nextY : y$2;
		middlewareData[name] = {
			...middlewareData[name],
			...data
		};
		if (reset && resetCount < MAX_RESET_COUNT) {
			resetCount++;
			if (typeof reset === "object") {
				if (reset.placement) statefulPlacement = reset.placement;
				if (reset.rects) rects = reset.rects === true ? await platform$1.getElementRects({
					reference,
					floating,
					strategy
				}) : reset.rects;
				({x: x$2, y: y$2} = computeCoordsFromPlacement(rects, statefulPlacement, rtl));
			}
			i = -1;
		}
	}
	return {
		x: x$2,
		y: y$2,
		placement: statefulPlacement,
		strategy,
		middlewareData
	};
};
var arrow$2 = (options) => ({
	name: "arrow",
	options,
	async fn(state) {
		const { x: x$2, y: y$2, placement, rects, platform: platform$1, elements, middlewareData } = state;
		const { element, padding = 0 } = evaluate(options, state) || {};
		if (element == null) return {};
		const paddingObject = getPaddingObject(padding);
		const coords = {
			x: x$2,
			y: y$2
		};
		const axis = getAlignmentAxis(placement);
		const length = getAxisLength(axis);
		const arrowDimensions = await platform$1.getDimensions(element);
		const isYAxis = axis === "y";
		const minProp = isYAxis ? "top" : "left";
		const maxProp = isYAxis ? "bottom" : "right";
		const clientProp = isYAxis ? "clientHeight" : "clientWidth";
		const endDiff = rects.reference[length] + rects.reference[axis] - coords[axis] - rects.floating[length];
		const startDiff = coords[axis] - rects.reference[axis];
		const arrowOffsetParent = await (platform$1.getOffsetParent == null ? void 0 : platform$1.getOffsetParent(element));
		let clientSize = arrowOffsetParent ? arrowOffsetParent[clientProp] : 0;
		if (!clientSize || !await (platform$1.isElement == null ? void 0 : platform$1.isElement(arrowOffsetParent))) clientSize = elements.floating[clientProp] || rects.floating[length];
		const centerToReference = endDiff / 2 - startDiff / 2;
		const largestPossiblePadding = clientSize / 2 - arrowDimensions[length] / 2 - 1;
		const minPadding = min(paddingObject[minProp], largestPossiblePadding);
		const maxPadding = min(paddingObject[maxProp], largestPossiblePadding);
		const max$1 = clientSize - arrowDimensions[length] - maxPadding;
		const center = clientSize / 2 - arrowDimensions[length] / 2 + centerToReference;
		const offset$3 = clamp(minPadding, center, max$1);
		const shouldAddOffset = !middlewareData.arrow && getAlignment(placement) != null && center !== offset$3 && rects.reference[length] / 2 - (center < minPadding ? minPadding : maxPadding) - arrowDimensions[length] / 2 < 0;
		const alignmentOffset = shouldAddOffset ? center < minPadding ? center - minPadding : center - max$1 : 0;
		return {
			[axis]: coords[axis] + alignmentOffset,
			data: {
				[axis]: offset$3,
				centerOffset: center - offset$3 - alignmentOffset,
				...shouldAddOffset && { alignmentOffset }
			},
			reset: shouldAddOffset
		};
	}
});
var flip$2 = function(options) {
	if (options === void 0) options = {};
	return {
		name: "flip",
		options,
		async fn(state) {
			var _middlewareData$arrow, _middlewareData$flip;
			const { placement, middlewareData, rects, initialPlacement, platform: platform$1, elements } = state;
			const { mainAxis: checkMainAxis = true, crossAxis: checkCrossAxis = true, fallbackPlacements: specifiedFallbackPlacements, fallbackStrategy = "bestFit", fallbackAxisSideDirection = "none", flipAlignment = true, ...detectOverflowOptions } = evaluate(options, state);
			if ((_middlewareData$arrow = middlewareData.arrow) != null && _middlewareData$arrow.alignmentOffset) return {};
			const side = getSide(placement);
			const initialSideAxis = getSideAxis(initialPlacement);
			const isBasePlacement = getSide(initialPlacement) === initialPlacement;
			const rtl = await (platform$1.isRTL == null ? void 0 : platform$1.isRTL(elements.floating));
			const fallbackPlacements = specifiedFallbackPlacements || (isBasePlacement || !flipAlignment ? [getOppositePlacement(initialPlacement)] : getExpandedPlacements(initialPlacement));
			const hasFallbackAxisSideDirection = fallbackAxisSideDirection !== "none";
			if (!specifiedFallbackPlacements && hasFallbackAxisSideDirection) fallbackPlacements.push(...getOppositeAxisPlacements(initialPlacement, flipAlignment, fallbackAxisSideDirection, rtl));
			const placements$1 = [initialPlacement, ...fallbackPlacements];
			const overflow = await platform$1.detectOverflow(state, detectOverflowOptions);
			const overflows = [];
			let overflowsData = ((_middlewareData$flip = middlewareData.flip) == null ? void 0 : _middlewareData$flip.overflows) || [];
			if (checkMainAxis) overflows.push(overflow[side]);
			if (checkCrossAxis) {
				const sides$1 = getAlignmentSides(placement, rects, rtl);
				overflows.push(overflow[sides$1[0]], overflow[sides$1[1]]);
			}
			overflowsData = [...overflowsData, {
				placement,
				overflows
			}];
			if (!overflows.every((side$1) => side$1 <= 0)) {
				var _middlewareData$flip2, _overflowsData$filter;
				const nextIndex = (((_middlewareData$flip2 = middlewareData.flip) == null ? void 0 : _middlewareData$flip2.index) || 0) + 1;
				const nextPlacement = placements$1[nextIndex];
				if (nextPlacement) {
					if (!(checkCrossAxis === "alignment" ? initialSideAxis !== getSideAxis(nextPlacement) : false) || overflowsData.every((d) => getSideAxis(d.placement) === initialSideAxis ? d.overflows[0] > 0 : true)) return {
						data: {
							index: nextIndex,
							overflows: overflowsData
						},
						reset: { placement: nextPlacement }
					};
				}
				let resetPlacement = (_overflowsData$filter = overflowsData.filter((d) => d.overflows[0] <= 0).sort((a, b$1) => a.overflows[1] - b$1.overflows[1])[0]) == null ? void 0 : _overflowsData$filter.placement;
				if (!resetPlacement) switch (fallbackStrategy) {
					case "bestFit": {
						var _overflowsData$filter2;
						const placement$1 = (_overflowsData$filter2 = overflowsData.filter((d) => {
							if (hasFallbackAxisSideDirection) {
								const currentSideAxis = getSideAxis(d.placement);
								return currentSideAxis === initialSideAxis || currentSideAxis === "y";
							}
							return true;
						}).map((d) => [d.placement, d.overflows.filter((overflow$1) => overflow$1 > 0).reduce((acc, overflow$1) => acc + overflow$1, 0)]).sort((a, b$1) => a[1] - b$1[1])[0]) == null ? void 0 : _overflowsData$filter2[0];
						if (placement$1) resetPlacement = placement$1;
						break;
					}
					case "initialPlacement":
						resetPlacement = initialPlacement;
						break;
				}
				if (placement !== resetPlacement) return { reset: { placement: resetPlacement } };
			}
			return {};
		}
	};
};
function getSideOffsets(overflow, rect) {
	return {
		top: overflow.top - rect.height,
		right: overflow.right - rect.width,
		bottom: overflow.bottom - rect.height,
		left: overflow.left - rect.width
	};
}
function isAnySideFullyClipped(overflow) {
	return sides.some((side) => overflow[side] >= 0);
}
var hide$2 = function(options) {
	if (options === void 0) options = {};
	return {
		name: "hide",
		options,
		async fn(state) {
			const { rects, platform: platform$1 } = state;
			const { strategy = "referenceHidden", ...detectOverflowOptions } = evaluate(options, state);
			switch (strategy) {
				case "referenceHidden": {
					const offsets = getSideOffsets(await platform$1.detectOverflow(state, {
						...detectOverflowOptions,
						elementContext: "reference"
					}), rects.reference);
					return { data: {
						referenceHiddenOffsets: offsets,
						referenceHidden: isAnySideFullyClipped(offsets)
					} };
				}
				case "escaped": {
					const offsets = getSideOffsets(await platform$1.detectOverflow(state, {
						...detectOverflowOptions,
						altBoundary: true
					}), rects.floating);
					return { data: {
						escapedOffsets: offsets,
						escaped: isAnySideFullyClipped(offsets)
					} };
				}
				default: return {};
			}
		}
	};
};
var originSides = /* @__PURE__ */ new Set(["left", "top"]);
async function convertValueToCoords(state, options) {
	const { placement, platform: platform$1, elements } = state;
	const rtl = await (platform$1.isRTL == null ? void 0 : platform$1.isRTL(elements.floating));
	const side = getSide(placement);
	const alignment = getAlignment(placement);
	const isVertical = getSideAxis(placement) === "y";
	const mainAxisMulti = originSides.has(side) ? -1 : 1;
	const crossAxisMulti = rtl && isVertical ? -1 : 1;
	const rawValue = evaluate(options, state);
	let { mainAxis, crossAxis, alignmentAxis } = typeof rawValue === "number" ? {
		mainAxis: rawValue,
		crossAxis: 0,
		alignmentAxis: null
	} : {
		mainAxis: rawValue.mainAxis || 0,
		crossAxis: rawValue.crossAxis || 0,
		alignmentAxis: rawValue.alignmentAxis
	};
	if (alignment && typeof alignmentAxis === "number") crossAxis = alignment === "end" ? alignmentAxis * -1 : alignmentAxis;
	return isVertical ? {
		x: crossAxis * crossAxisMulti,
		y: mainAxis * mainAxisMulti
	} : {
		x: mainAxis * mainAxisMulti,
		y: crossAxis * crossAxisMulti
	};
}
var offset$2 = function(options) {
	if (options === void 0) options = 0;
	return {
		name: "offset",
		options,
		async fn(state) {
			var _middlewareData$offse, _middlewareData$arrow;
			const { x: x$2, y: y$2, placement, middlewareData } = state;
			const diffCoords = await convertValueToCoords(state, options);
			if (placement === ((_middlewareData$offse = middlewareData.offset) == null ? void 0 : _middlewareData$offse.placement) && (_middlewareData$arrow = middlewareData.arrow) != null && _middlewareData$arrow.alignmentOffset) return {};
			return {
				x: x$2 + diffCoords.x,
				y: y$2 + diffCoords.y,
				data: {
					...diffCoords,
					placement
				}
			};
		}
	};
};
var shift$2 = function(options) {
	if (options === void 0) options = {};
	return {
		name: "shift",
		options,
		async fn(state) {
			const { x: x$2, y: y$2, placement, platform: platform$1 } = state;
			const { mainAxis: checkMainAxis = true, crossAxis: checkCrossAxis = false, limiter = { fn: (_ref) => {
				let { x: x$3, y: y$3 } = _ref;
				return {
					x: x$3,
					y: y$3
				};
			} }, ...detectOverflowOptions } = evaluate(options, state);
			const coords = {
				x: x$2,
				y: y$2
			};
			const overflow = await platform$1.detectOverflow(state, detectOverflowOptions);
			const crossAxis = getSideAxis(placement);
			const mainAxis = getOppositeAxis(crossAxis);
			let mainAxisCoord = coords[mainAxis];
			let crossAxisCoord = coords[crossAxis];
			const clampCoord = (axis, coord) => clamp(coord + overflow[axis === "y" ? "top" : "left"], coord, coord - overflow[axis === "y" ? "bottom" : "right"]);
			if (checkMainAxis) mainAxisCoord = clampCoord(mainAxis, mainAxisCoord);
			if (checkCrossAxis) crossAxisCoord = clampCoord(crossAxis, crossAxisCoord);
			const limitedCoords = limiter.fn({
				...state,
				[mainAxis]: mainAxisCoord,
				[crossAxis]: crossAxisCoord
			});
			return {
				...limitedCoords,
				data: {
					x: limitedCoords.x - x$2,
					y: limitedCoords.y - y$2,
					enabled: {
						[mainAxis]: checkMainAxis,
						[crossAxis]: checkCrossAxis
					}
				}
			};
		}
	};
};
var limitShift$2 = function(options) {
	if (options === void 0) options = {};
	return {
		options,
		fn(state) {
			var _rawOffset$mainAxis, _rawOffset$crossAxis;
			const { x: x$2, y: y$2, placement, rects, middlewareData } = state;
			const { offset: offset$3 = 0, mainAxis: checkMainAxis = true, crossAxis: checkCrossAxis = true } = evaluate(options, state);
			const coords = {
				x: x$2,
				y: y$2
			};
			const crossAxis = getSideAxis(placement);
			const mainAxis = getOppositeAxis(crossAxis);
			let mainAxisCoord = coords[mainAxis];
			let crossAxisCoord = coords[crossAxis];
			const rawOffset = evaluate(offset$3, state);
			const computedOffset = typeof rawOffset === "number" ? {
				mainAxis: rawOffset,
				crossAxis: 0
			} : {
				mainAxis: (_rawOffset$mainAxis = rawOffset.mainAxis) != null ? _rawOffset$mainAxis : 0,
				crossAxis: (_rawOffset$crossAxis = rawOffset.crossAxis) != null ? _rawOffset$crossAxis : 0
			};
			if (checkMainAxis) {
				const len = mainAxis === "y" ? "height" : "width";
				const limitMin = rects.reference[mainAxis] - rects.floating[len] + computedOffset.mainAxis;
				const limitMax = rects.reference[mainAxis] + rects.reference[len] - computedOffset.mainAxis;
				if (mainAxisCoord < limitMin) mainAxisCoord = limitMin;
				else if (mainAxisCoord > limitMax) mainAxisCoord = limitMax;
			}
			if (checkCrossAxis) {
				var _middlewareData$offse, _middlewareData$offse2;
				const len = mainAxis === "y" ? "width" : "height";
				const isOriginSide = originSides.has(getSide(placement));
				const limitMin = rects.reference[crossAxis] - rects.floating[len] + (isOriginSide ? ((_middlewareData$offse = middlewareData.offset) == null ? void 0 : _middlewareData$offse[crossAxis]) || 0 : 0) + (isOriginSide ? 0 : computedOffset.crossAxis);
				const limitMax = rects.reference[crossAxis] + rects.reference[len] + (isOriginSide ? 0 : ((_middlewareData$offse2 = middlewareData.offset) == null ? void 0 : _middlewareData$offse2[crossAxis]) || 0) - (isOriginSide ? computedOffset.crossAxis : 0);
				if (crossAxisCoord < limitMin) crossAxisCoord = limitMin;
				else if (crossAxisCoord > limitMax) crossAxisCoord = limitMax;
			}
			return {
				[mainAxis]: mainAxisCoord,
				[crossAxis]: crossAxisCoord
			};
		}
	};
};
var size$2 = function(options) {
	if (options === void 0) options = {};
	return {
		name: "size",
		options,
		async fn(state) {
			const { placement, rects, platform: platform$1, elements } = state;
			const { apply = () => {}, ...detectOverflowOptions } = evaluate(options, state);
			const overflow = await platform$1.detectOverflow(state, detectOverflowOptions);
			const side = getSide(placement);
			const alignment = getAlignment(placement);
			const isYAxis = getSideAxis(placement) === "y";
			const { width, height } = rects.floating;
			let heightSide;
			let widthSide;
			if (side === "top" || side === "bottom") {
				heightSide = side;
				widthSide = alignment === (await (platform$1.isRTL == null ? void 0 : platform$1.isRTL(elements.floating)) ? "start" : "end") ? "left" : "right";
			} else {
				widthSide = side;
				heightSide = alignment === "end" ? "top" : "bottom";
			}
			const maximumClippingHeight = height - overflow.top - overflow.bottom;
			const maximumClippingWidth = width - overflow.left - overflow.right;
			const overflowAvailableHeight = min(height - overflow[heightSide], maximumClippingHeight);
			const overflowAvailableWidth = min(width - overflow[widthSide], maximumClippingWidth);
			const shiftData = state.middlewareData.shift;
			const noShift = !shiftData;
			let availableHeight = overflowAvailableHeight;
			let availableWidth = overflowAvailableWidth;
			if (shiftData != null && shiftData.enabled.x) availableWidth = maximumClippingWidth;
			if (shiftData != null && shiftData.enabled.y) availableHeight = maximumClippingHeight;
			if (noShift && !alignment) if (isYAxis) availableWidth = width - 2 * max(overflow.left, overflow.right);
			else availableHeight = height - 2 * max(overflow.top, overflow.bottom);
			await apply({
				...state,
				availableWidth,
				availableHeight
			});
			const nextDimensions = await platform$1.getDimensions(elements.floating);
			if (width !== nextDimensions.width || height !== nextDimensions.height) return { reset: { rects: true } };
			return {};
		}
	};
};
function hasWindow() {
	return typeof window !== "undefined";
}
function getNodeName(node) {
	if (isNode(node)) return (node.nodeName || "").toLowerCase();
	return "#document";
}
function getWindow(node) {
	var _node$ownerDocument;
	return (node == null || (_node$ownerDocument = node.ownerDocument) == null ? void 0 : _node$ownerDocument.defaultView) || window;
}
function getDocumentElement(node) {
	var _ref;
	return (_ref = (isNode(node) ? node.ownerDocument : node.document) || window.document) == null ? void 0 : _ref.documentElement;
}
function isNode(value) {
	if (!hasWindow()) return false;
	return value instanceof Node || value instanceof getWindow(value).Node;
}
function isElement(value) {
	if (!hasWindow()) return false;
	return value instanceof Element || value instanceof getWindow(value).Element;
}
function isHTMLElement(value) {
	if (!hasWindow()) return false;
	return value instanceof HTMLElement || value instanceof getWindow(value).HTMLElement;
}
function isShadowRoot(value) {
	if (!hasWindow() || typeof ShadowRoot === "undefined") return false;
	return value instanceof ShadowRoot || value instanceof getWindow(value).ShadowRoot;
}
function isOverflowElement(element) {
	const { overflow, overflowX, overflowY, display } = getComputedStyle$1(element);
	return /auto|scroll|overlay|hidden|clip/.test(overflow + overflowY + overflowX) && display !== "inline" && display !== "contents";
}
function isTableElement(element) {
	return /^(table|td|th)$/.test(getNodeName(element));
}
function isTopLayer(element) {
	try {
		if (element.matches(":popover-open")) return true;
	} catch (_e) {}
	try {
		return element.matches(":modal");
	} catch (_e) {
		return false;
	}
}
var willChangeRe = /transform|translate|scale|rotate|perspective|filter/;
var containRe = /paint|layout|strict|content/;
var isNotNone = (value) => !!value && value !== "none";
var isWebKitValue;
function isContainingBlock(elementOrCss) {
	const css = isElement(elementOrCss) ? getComputedStyle$1(elementOrCss) : elementOrCss;
	return isNotNone(css.transform) || isNotNone(css.translate) || isNotNone(css.scale) || isNotNone(css.rotate) || isNotNone(css.perspective) || !isWebKit() && (isNotNone(css.backdropFilter) || isNotNone(css.filter)) || willChangeRe.test(css.willChange || "") || containRe.test(css.contain || "");
}
function getContainingBlock(element) {
	let currentNode = getParentNode(element);
	while (isHTMLElement(currentNode) && !isLastTraversableNode(currentNode)) {
		if (isContainingBlock(currentNode)) return currentNode;
		else if (isTopLayer(currentNode)) return null;
		currentNode = getParentNode(currentNode);
	}
	return null;
}
function isWebKit() {
	if (isWebKitValue == null) isWebKitValue = typeof CSS !== "undefined" && CSS.supports && CSS.supports("-webkit-backdrop-filter", "none");
	return isWebKitValue;
}
function isLastTraversableNode(node) {
	return /^(html|body|#document)$/.test(getNodeName(node));
}
function getComputedStyle$1(element) {
	return getWindow(element).getComputedStyle(element);
}
function getNodeScroll(element) {
	if (isElement(element)) return {
		scrollLeft: element.scrollLeft,
		scrollTop: element.scrollTop
	};
	return {
		scrollLeft: element.scrollX,
		scrollTop: element.scrollY
	};
}
function getParentNode(node) {
	if (getNodeName(node) === "html") return node;
	const result = node.assignedSlot || node.parentNode || isShadowRoot(node) && node.host || getDocumentElement(node);
	return isShadowRoot(result) ? result.host : result;
}
function getNearestOverflowAncestor(node) {
	const parentNode = getParentNode(node);
	if (isLastTraversableNode(parentNode)) return (node.ownerDocument || node).body;
	if (isHTMLElement(parentNode) && isOverflowElement(parentNode)) return parentNode;
	return getNearestOverflowAncestor(parentNode);
}
function getOverflowAncestors(node, list, traverseIframes) {
	var _node$ownerDocument2;
	if (list === void 0) list = [];
	if (traverseIframes === void 0) traverseIframes = true;
	const scrollableAncestor = getNearestOverflowAncestor(node);
	const isBody = scrollableAncestor === ((_node$ownerDocument2 = node.ownerDocument) == null ? void 0 : _node$ownerDocument2.body);
	const win = getWindow(scrollableAncestor);
	if (isBody) {
		const frameElement = getFrameElement(win);
		return list.concat(win, win.visualViewport || [], isOverflowElement(scrollableAncestor) ? scrollableAncestor : [], frameElement && traverseIframes ? getOverflowAncestors(frameElement) : []);
	} else return list.concat(scrollableAncestor, getOverflowAncestors(scrollableAncestor, [], traverseIframes));
}
function getFrameElement(win) {
	return win.parent && Object.getPrototypeOf(win.parent) ? win.frameElement : null;
}
function getCssDimensions(element) {
	const css = getComputedStyle$1(element);
	let width = parseFloat(css.width) || 0;
	let height = parseFloat(css.height) || 0;
	const hasOffset = isHTMLElement(element);
	const offsetWidth = hasOffset ? element.offsetWidth : width;
	const offsetHeight = hasOffset ? element.offsetHeight : height;
	const shouldFallback = round(width) !== offsetWidth || round(height) !== offsetHeight;
	if (shouldFallback) {
		width = offsetWidth;
		height = offsetHeight;
	}
	return {
		width,
		height,
		$: shouldFallback
	};
}
function unwrapElement(element) {
	return !isElement(element) ? element.contextElement : element;
}
function getScale(element) {
	const domElement = unwrapElement(element);
	if (!isHTMLElement(domElement)) return createCoords(1);
	const rect = domElement.getBoundingClientRect();
	const { width, height, $ } = getCssDimensions(domElement);
	let x$2 = ($ ? round(rect.width) : rect.width) / width;
	let y$2 = ($ ? round(rect.height) : rect.height) / height;
	if (!x$2 || !Number.isFinite(x$2)) x$2 = 1;
	if (!y$2 || !Number.isFinite(y$2)) y$2 = 1;
	return {
		x: x$2,
		y: y$2
	};
}
var noOffsets = /* @__PURE__ */ createCoords(0);
function getVisualOffsets(element) {
	const win = getWindow(element);
	if (!isWebKit() || !win.visualViewport) return noOffsets;
	return {
		x: win.visualViewport.offsetLeft,
		y: win.visualViewport.offsetTop
	};
}
function shouldAddVisualOffsets(element, isFixed, floatingOffsetParent) {
	if (isFixed === void 0) isFixed = false;
	return !!floatingOffsetParent && isFixed && floatingOffsetParent === getWindow(element);
}
function getBoundingClientRect(element, includeScale, isFixedStrategy, offsetParent) {
	if (includeScale === void 0) includeScale = false;
	if (isFixedStrategy === void 0) isFixedStrategy = false;
	const clientRect = element.getBoundingClientRect();
	const domElement = unwrapElement(element);
	let scale = createCoords(1);
	if (includeScale) if (offsetParent) {
		if (isElement(offsetParent)) scale = getScale(offsetParent);
	} else scale = getScale(element);
	const visualOffsets = shouldAddVisualOffsets(domElement, isFixedStrategy, offsetParent) ? getVisualOffsets(domElement) : createCoords(0);
	let x$2 = (clientRect.left + visualOffsets.x) / scale.x;
	let y$2 = (clientRect.top + visualOffsets.y) / scale.y;
	let width = clientRect.width / scale.x;
	let height = clientRect.height / scale.y;
	if (domElement && offsetParent) {
		const win = getWindow(domElement);
		const offsetWin = isElement(offsetParent) ? getWindow(offsetParent) : offsetParent;
		let currentWin = win;
		let currentIFrame = getFrameElement(currentWin);
		while (currentIFrame && offsetWin !== currentWin) {
			const iframeScale = getScale(currentIFrame);
			const iframeRect = currentIFrame.getBoundingClientRect();
			const css = getComputedStyle$1(currentIFrame);
			const left = iframeRect.left + (currentIFrame.clientLeft + parseFloat(css.paddingLeft)) * iframeScale.x;
			const top = iframeRect.top + (currentIFrame.clientTop + parseFloat(css.paddingTop)) * iframeScale.y;
			x$2 *= iframeScale.x;
			y$2 *= iframeScale.y;
			width *= iframeScale.x;
			height *= iframeScale.y;
			x$2 += left;
			y$2 += top;
			currentWin = getWindow(currentIFrame);
			currentIFrame = getFrameElement(currentWin);
		}
	}
	return rectToClientRect({
		width,
		height,
		x: x$2,
		y: y$2
	});
}
function getWindowScrollBarX(element, rect) {
	const leftScroll = getNodeScroll(element).scrollLeft;
	if (!rect) return getBoundingClientRect(getDocumentElement(element)).left + leftScroll;
	return rect.left + leftScroll;
}
function getHTMLOffset(documentElement, scroll) {
	const htmlRect = documentElement.getBoundingClientRect();
	return {
		x: htmlRect.left + scroll.scrollLeft - getWindowScrollBarX(documentElement, htmlRect),
		y: htmlRect.top + scroll.scrollTop
	};
}
function convertOffsetParentRelativeRectToViewportRelativeRect(_ref) {
	let { elements, rect, offsetParent, strategy } = _ref;
	const isFixed = strategy === "fixed";
	const documentElement = getDocumentElement(offsetParent);
	const topLayer = elements ? isTopLayer(elements.floating) : false;
	if (offsetParent === documentElement || topLayer && isFixed) return rect;
	let scroll = {
		scrollLeft: 0,
		scrollTop: 0
	};
	let scale = createCoords(1);
	const offsets = createCoords(0);
	const isOffsetParentAnElement = isHTMLElement(offsetParent);
	if (isOffsetParentAnElement || !isFixed) {
		if (getNodeName(offsetParent) !== "body" || isOverflowElement(documentElement)) scroll = getNodeScroll(offsetParent);
		if (isOffsetParentAnElement) {
			const offsetRect = getBoundingClientRect(offsetParent);
			scale = getScale(offsetParent);
			offsets.x = offsetRect.x + offsetParent.clientLeft;
			offsets.y = offsetRect.y + offsetParent.clientTop;
		}
	}
	const htmlOffset = documentElement && !isOffsetParentAnElement && !isFixed ? getHTMLOffset(documentElement, scroll) : createCoords(0);
	return {
		width: rect.width * scale.x,
		height: rect.height * scale.y,
		x: rect.x * scale.x - scroll.scrollLeft * scale.x + offsets.x + htmlOffset.x,
		y: rect.y * scale.y - scroll.scrollTop * scale.y + offsets.y + htmlOffset.y
	};
}
function getClientRects(element) {
	return element.getClientRects ? Array.from(element.getClientRects()) : [];
}
function getDocumentRect(html) {
	const scroll = getNodeScroll(html);
	const body = html.ownerDocument.body;
	const width = max(html.scrollWidth, html.clientWidth, body.scrollWidth, body.clientWidth);
	const height = max(html.scrollHeight, html.clientHeight, body.scrollHeight, body.clientHeight);
	let x$2 = -scroll.scrollLeft + getWindowScrollBarX(html);
	const y$2 = -scroll.scrollTop;
	if (getComputedStyle$1(body).direction === "rtl") x$2 += max(html.clientWidth, body.clientWidth) - width;
	return {
		width,
		height,
		x: x$2,
		y: y$2
	};
}
var SCROLLBAR_MAX = 25;
function getViewportRect(element, strategy, rootBoundary) {
	if (rootBoundary === void 0) rootBoundary = "viewport";
	const isLayoutViewport = rootBoundary === "layoutViewport";
	const win = getWindow(element);
	const html = getDocumentElement(element);
	const visualViewport = win.visualViewport;
	let width = html.clientWidth;
	let height = html.clientHeight;
	let x$2 = 0;
	let y$2 = 0;
	if (visualViewport) {
		const layoutRelativeClientCoords = !isWebKit() || strategy === "fixed";
		if (isLayoutViewport) {
			if (!layoutRelativeClientCoords) {
				x$2 = -visualViewport.offsetLeft;
				y$2 = -visualViewport.offsetTop;
			}
		} else {
			width = visualViewport.width;
			height = visualViewport.height;
			if (layoutRelativeClientCoords) {
				x$2 = visualViewport.offsetLeft;
				y$2 = visualViewport.offsetTop;
			}
		}
	}
	if (getWindowScrollBarX(html) <= 0) {
		const doc = html.ownerDocument;
		const body = doc.body;
		const bodyStyles = getComputedStyle(body);
		const bodyMarginInline = doc.compatMode === "CSS1Compat" ? parseFloat(bodyStyles.marginLeft) + parseFloat(bodyStyles.marginRight) || 0 : 0;
		const reservedWidth = Math.abs(html.clientWidth - body.clientWidth - bodyMarginInline);
		const gutter = getComputedStyle(html).scrollbarGutter === "stable both-edges" ? reservedWidth / 2 : reservedWidth;
		if (gutter <= SCROLLBAR_MAX) width -= gutter;
	}
	return {
		width,
		height,
		x: x$2,
		y: y$2
	};
}
function getInnerBoundingClientRect(element, strategy) {
	const clientRect = getBoundingClientRect(element, true, strategy === "fixed");
	const top = clientRect.top + element.clientTop;
	const left = clientRect.left + element.clientLeft;
	const scale = getScale(element);
	return {
		width: element.clientWidth * scale.x,
		height: element.clientHeight * scale.y,
		x: left * scale.x,
		y: top * scale.y
	};
}
function getClientRectFromClippingAncestor(element, clippingAncestor, strategy) {
	let rect;
	if (clippingAncestor === "viewport" || clippingAncestor === "layoutViewport") rect = getViewportRect(element, strategy, clippingAncestor);
	else if (clippingAncestor === "document") rect = getDocumentRect(getDocumentElement(element));
	else if (isElement(clippingAncestor)) rect = getInnerBoundingClientRect(clippingAncestor, strategy);
	else {
		const visualOffsets = getVisualOffsets(element);
		rect = {
			x: clippingAncestor.x - visualOffsets.x,
			y: clippingAncestor.y - visualOffsets.y,
			width: clippingAncestor.width,
			height: clippingAncestor.height
		};
	}
	return rectToClientRect(rect);
}
function getClippingElementAncestors(element, cache) {
	const cachedResult = cache.get(element);
	if (cachedResult) return cachedResult;
	let result = getOverflowAncestors(element, [], false).filter((el$1) => isElement(el$1) && getNodeName(el$1) !== "body");
	let lastKeptComputedStyle = null;
	const elementIsFixed = getComputedStyle$1(element).position === "fixed";
	let currentNode = elementIsFixed ? getParentNode(element) : element;
	while (isElement(currentNode) && !isLastTraversableNode(currentNode)) {
		const computedStyle = getComputedStyle$1(currentNode);
		const currentNodeIsContaining = isContainingBlock(currentNode);
		const lastPosition = lastKeptComputedStyle ? lastKeptComputedStyle.position : elementIsFixed ? "fixed" : "";
		if (!currentNodeIsContaining && (lastPosition === "fixed" || lastPosition === "absolute" && computedStyle.position === "static")) result = result.filter((ancestor) => ancestor !== currentNode);
		else lastKeptComputedStyle = computedStyle;
		currentNode = getParentNode(currentNode);
	}
	cache.set(element, result);
	return result;
}
function getClippingRect(_ref) {
	let { element, boundary, rootBoundary, strategy } = _ref;
	const clippingAncestors = [...boundary === "clippingAncestors" ? isTopLayer(element) ? [] : getClippingElementAncestors(element, this._c) : [].concat(boundary), rootBoundary];
	const firstRect = getClientRectFromClippingAncestor(element, clippingAncestors[0], strategy);
	let top = firstRect.top;
	let right = firstRect.right;
	let bottom = firstRect.bottom;
	let left = firstRect.left;
	for (let i = 1; i < clippingAncestors.length; i++) {
		const rect = getClientRectFromClippingAncestor(element, clippingAncestors[i], strategy);
		top = max(rect.top, top);
		right = min(rect.right, right);
		bottom = min(rect.bottom, bottom);
		left = max(rect.left, left);
	}
	return {
		width: right - left,
		height: bottom - top,
		x: left,
		y: top
	};
}
function getDimensions(element) {
	const { width, height } = getCssDimensions(element);
	return {
		width,
		height
	};
}
function getRectRelativeToOffsetParent(element, offsetParent, strategy) {
	const isOffsetParentAnElement = isHTMLElement(offsetParent);
	const documentElement = getDocumentElement(offsetParent);
	const isFixed = strategy === "fixed";
	const rect = getBoundingClientRect(element, true, isFixed, offsetParent);
	let scroll = {
		scrollLeft: 0,
		scrollTop: 0
	};
	const offsets = createCoords(0);
	if (isOffsetParentAnElement || !isFixed) {
		if (getNodeName(offsetParent) !== "body" || isOverflowElement(documentElement)) scroll = getNodeScroll(offsetParent);
		if (isOffsetParentAnElement) {
			const offsetRect = getBoundingClientRect(offsetParent, true, isFixed, offsetParent);
			offsets.x = offsetRect.x + offsetParent.clientLeft;
			offsets.y = offsetRect.y + offsetParent.clientTop;
		}
	}
	if (!isOffsetParentAnElement && documentElement) offsets.x = getWindowScrollBarX(documentElement);
	const htmlOffset = documentElement && !isOffsetParentAnElement && !isFixed ? getHTMLOffset(documentElement, scroll) : createCoords(0);
	return {
		x: rect.left + scroll.scrollLeft - offsets.x - htmlOffset.x,
		y: rect.top + scroll.scrollTop - offsets.y - htmlOffset.y,
		width: rect.width,
		height: rect.height
	};
}
function isStaticPositioned(element) {
	return getComputedStyle$1(element).position === "static";
}
function getTrueOffsetParent(element, polyfill) {
	if (!isHTMLElement(element) || getComputedStyle$1(element).position === "fixed") return null;
	if (polyfill) return polyfill(element);
	let rawOffsetParent = element.offsetParent;
	if (getDocumentElement(element) === rawOffsetParent) rawOffsetParent = rawOffsetParent.ownerDocument.body;
	return rawOffsetParent;
}
function getOffsetParent(element, polyfill) {
	const win = getWindow(element);
	if (isTopLayer(element)) return win;
	if (!isHTMLElement(element)) {
		let svgOffsetParent = getParentNode(element);
		while (svgOffsetParent && !isLastTraversableNode(svgOffsetParent)) {
			if (isElement(svgOffsetParent) && !isStaticPositioned(svgOffsetParent)) return svgOffsetParent;
			svgOffsetParent = getParentNode(svgOffsetParent);
		}
		return win;
	}
	let offsetParent = getTrueOffsetParent(element, polyfill);
	while (offsetParent && isTableElement(offsetParent) && isStaticPositioned(offsetParent)) offsetParent = getTrueOffsetParent(offsetParent, polyfill);
	if (offsetParent && isLastTraversableNode(offsetParent) && isStaticPositioned(offsetParent) && !isContainingBlock(offsetParent)) return win;
	return offsetParent || getContainingBlock(element) || win;
}
var getElementRects = async function(data) {
	const getOffsetParentFn = this.getOffsetParent || getOffsetParent;
	const getDimensionsFn = this.getDimensions;
	const floatingDimensions = await getDimensionsFn(data.floating);
	return {
		reference: getRectRelativeToOffsetParent(data.reference, await getOffsetParentFn(data.floating), data.strategy),
		floating: {
			x: 0,
			y: 0,
			width: floatingDimensions.width,
			height: floatingDimensions.height
		}
	};
};
function isRTL(element) {
	return getComputedStyle$1(element).direction === "rtl";
}
var platform = {
	convertOffsetParentRelativeRectToViewportRelativeRect,
	getDocumentElement,
	getClippingRect,
	getOffsetParent,
	getElementRects,
	getClientRects,
	getDimensions,
	getScale,
	isElement,
	isRTL
};
function rectsAreEqual(a, b$1) {
	return a.x === b$1.x && a.y === b$1.y && a.width === b$1.width && a.height === b$1.height;
}
function observeMove(element, onMove, ancestorResize) {
	let io = null;
	let timeoutId;
	const root = getDocumentElement(element);
	function cleanup() {
		var _io;
		clearTimeout(timeoutId);
		(_io = io) == null || _io.disconnect();
		io = null;
	}
	function refresh(skip, threshold) {
		if (skip === void 0) skip = false;
		if (threshold === void 0) threshold = 1;
		cleanup();
		const elementRectForRootMargin = element.getBoundingClientRect();
		const { left, top, width, height } = elementRectForRootMargin;
		if (!skip) onMove();
		if (!width || !height) return;
		const insetTop = floor(top);
		const insetRight = floor(root.clientWidth - (left + width));
		const insetBottom = floor(root.clientHeight - (top + height));
		const insetLeft = floor(left);
		const options = {
			rootMargin: -insetTop + "px " + -insetRight + "px " + -insetBottom + "px " + -insetLeft + "px",
			threshold: max(0, min(1, threshold)) || 1
		};
		let isFirstUpdate = true;
		function handleObserve(entries) {
			const ratio = entries[0].intersectionRatio;
			if (!rectsAreEqual(elementRectForRootMargin, element.getBoundingClientRect())) return refresh();
			if (ratio !== threshold) {
				if (!isFirstUpdate) return refresh();
				if (!ratio) timeoutId = setTimeout(() => {
					refresh(false, 1e-7);
				}, 1e3);
				else refresh(false, ratio);
			}
			isFirstUpdate = false;
		}
		try {
			io = new IntersectionObserver(handleObserve, {
				...options,
				root: root.ownerDocument
			});
		} catch (_e) {
			io = new IntersectionObserver(handleObserve, options);
		}
		io.observe(element);
	}
	const win = getWindow(element);
	const handleResize = () => refresh(ancestorResize);
	win.addEventListener("resize", handleResize);
	refresh(true);
	return () => {
		win.removeEventListener("resize", handleResize);
		cleanup();
	};
}
function autoUpdate(reference, floating, update, options) {
	if (options === void 0) options = {};
	const { ancestorScroll = true, ancestorResize = true, elementResize = typeof ResizeObserver === "function", layoutShift = typeof IntersectionObserver === "function", animationFrame = false } = options;
	const referenceEl = unwrapElement(reference);
	const ancestors = ancestorScroll || ancestorResize ? [...referenceEl ? getOverflowAncestors(referenceEl) : [], ...floating ? getOverflowAncestors(floating) : []] : [];
	ancestors.forEach((ancestor) => {
		ancestorScroll && ancestor.addEventListener("scroll", update);
		ancestorResize && ancestor.addEventListener("resize", update);
	});
	const cleanupIo = referenceEl && layoutShift ? observeMove(referenceEl, update, ancestorResize) : null;
	let reobserveFrame = -1;
	let resizeObserver = null;
	if (elementResize) {
		resizeObserver = new ResizeObserver((_ref) => {
			let [firstEntry] = _ref;
			if (firstEntry && firstEntry.target === referenceEl && resizeObserver && floating) {
				resizeObserver.unobserve(floating);
				cancelAnimationFrame(reobserveFrame);
				reobserveFrame = requestAnimationFrame(() => {
					var _resizeObserver;
					(_resizeObserver = resizeObserver) == null || _resizeObserver.observe(floating);
				});
			}
			update();
		});
		if (referenceEl && !animationFrame) resizeObserver.observe(referenceEl);
		if (floating) resizeObserver.observe(floating);
	}
	let frameId;
	let prevRefRect = animationFrame ? getBoundingClientRect(reference) : null;
	if (animationFrame) frameLoop();
	function frameLoop() {
		const nextRefRect = getBoundingClientRect(reference);
		if (prevRefRect && !rectsAreEqual(prevRefRect, nextRefRect)) update();
		prevRefRect = nextRefRect;
		frameId = requestAnimationFrame(frameLoop);
	}
	update();
	return () => {
		var _resizeObserver2;
		ancestors.forEach((ancestor) => {
			ancestorScroll && ancestor.removeEventListener("scroll", update);
			ancestorResize && ancestor.removeEventListener("resize", update);
		});
		cleanupIo?.();
		(_resizeObserver2 = resizeObserver) == null || _resizeObserver2.disconnect();
		resizeObserver = null;
		if (animationFrame) cancelAnimationFrame(frameId);
	};
}
var offset$1 = offset$2;
var shift$1 = shift$2;
var flip$1 = flip$2;
var size$1 = size$2;
var hide$1 = hide$2;
var arrow$1 = arrow$2;
var limitShift$1 = limitShift$2;
var computePosition = (reference, floating, options) => {
	const cache = /* @__PURE__ */ new Map();
	const mergedOptions = options != null ? options : {};
	const platformWithCache = {
		...platform,
		...mergedOptions.platform,
		_c: cache
	};
	return computePosition$1(reference, floating, {
		...mergedOptions,
		platform: platformWithCache
	});
};
var import_react_dom$1 = /* @__PURE__ */ __toESM(require_react_dom(), 1);
var index = typeof document !== "undefined" ? import_react.useLayoutEffect : function noop() {};
function deepEqual(a, b$1) {
	if (a === b$1) return true;
	if (typeof a !== typeof b$1) return false;
	if (typeof a === "function" && a.toString() === b$1.toString()) return true;
	let length;
	let i;
	let keys;
	if (a && b$1 && typeof a === "object") {
		if (Array.isArray(a)) {
			length = a.length;
			if (length !== b$1.length) return false;
			for (i = length; i-- !== 0;) if (!deepEqual(a[i], b$1[i])) return false;
			return true;
		}
		keys = Object.keys(a);
		length = keys.length;
		if (length !== Object.keys(b$1).length) return false;
		for (i = length; i-- !== 0;) if (!{}.hasOwnProperty.call(b$1, keys[i])) return false;
		for (i = length; i-- !== 0;) {
			const key = keys[i];
			if (key === "_owner" && a.$$typeof) continue;
			if (!deepEqual(a[key], b$1[key])) return false;
		}
		return true;
	}
	return a !== a && b$1 !== b$1;
}
function getDPR(element) {
	if (typeof window === "undefined") return 1;
	return (element.ownerDocument.defaultView || window).devicePixelRatio || 1;
}
function roundByDPR(element, value) {
	const dpr = getDPR(element);
	return Math.round(value * dpr) / dpr;
}
function useLatestRef(value) {
	const ref = import_react.useRef(value);
	index(() => {
		ref.current = value;
	});
	return ref;
}
function useFloating(options) {
	if (options === void 0) options = {};
	const { placement = "bottom", strategy = "absolute", middleware = [], platform: platform$1, elements: { reference: externalReference, floating: externalFloating } = {}, transform = true, whileElementsMounted, open } = options;
	const [data, setData] = import_react.useState({
		x: 0,
		y: 0,
		strategy,
		placement,
		middlewareData: {},
		isPositioned: false
	});
	const [latestMiddleware, setLatestMiddleware] = import_react.useState(middleware);
	if (!deepEqual(latestMiddleware, middleware)) setLatestMiddleware(middleware);
	const [_reference, _setReference] = import_react.useState(null);
	const [_floating, _setFloating] = import_react.useState(null);
	const setReference = import_react.useCallback((node) => {
		if (node !== referenceRef.current) {
			referenceRef.current = node;
			_setReference(node);
		}
	}, []);
	const setFloating = import_react.useCallback((node) => {
		if (node !== floatingRef.current) {
			floatingRef.current = node;
			_setFloating(node);
		}
	}, []);
	const referenceEl = externalReference || _reference;
	const floatingEl = externalFloating || _floating;
	const referenceRef = import_react.useRef(null);
	const floatingRef = import_react.useRef(null);
	const dataRef = import_react.useRef(data);
	const hasWhileElementsMounted = whileElementsMounted != null;
	const whileElementsMountedRef = useLatestRef(whileElementsMounted);
	const platformRef = useLatestRef(platform$1);
	const openRef = useLatestRef(open);
	const update = import_react.useCallback(() => {
		if (!referenceRef.current || !floatingRef.current) return;
		const config = {
			placement,
			strategy,
			middleware: latestMiddleware
		};
		if (platformRef.current) config.platform = platformRef.current;
		computePosition(referenceRef.current, floatingRef.current, config).then((data$1) => {
			const fullData = {
				...data$1,
				isPositioned: openRef.current !== false
			};
			if (isMountedRef.current && !deepEqual(dataRef.current, fullData)) {
				dataRef.current = fullData;
				import_react_dom$1.flushSync(() => {
					setData(fullData);
				});
			}
		});
	}, [
		latestMiddleware,
		placement,
		strategy,
		platformRef,
		openRef
	]);
	index(() => {
		if (open === false && dataRef.current.isPositioned) {
			dataRef.current.isPositioned = false;
			setData((data$1) => ({
				...data$1,
				isPositioned: false
			}));
		}
	}, [open]);
	const isMountedRef = import_react.useRef(false);
	index(() => {
		isMountedRef.current = true;
		return () => {
			isMountedRef.current = false;
		};
	}, []);
	index(() => {
		if (referenceEl) referenceRef.current = referenceEl;
		if (floatingEl) floatingRef.current = floatingEl;
		if (referenceEl && floatingEl) {
			if (whileElementsMountedRef.current) return whileElementsMountedRef.current(referenceEl, floatingEl, update);
			update();
		}
	}, [
		referenceEl,
		floatingEl,
		update,
		whileElementsMountedRef,
		hasWhileElementsMounted
	]);
	const refs = import_react.useMemo(() => ({
		reference: referenceRef,
		floating: floatingRef,
		setReference,
		setFloating
	}), [setReference, setFloating]);
	const elements = import_react.useMemo(() => ({
		reference: referenceEl,
		floating: floatingEl
	}), [referenceEl, floatingEl]);
	const floatingStyles = import_react.useMemo(() => {
		const initialStyles = {
			position: strategy,
			left: 0,
			top: 0
		};
		if (!elements.floating) return initialStyles;
		const x$2 = roundByDPR(elements.floating, data.x);
		const y$2 = roundByDPR(elements.floating, data.y);
		if (transform) return {
			...initialStyles,
			transform: "translate(" + x$2 + "px, " + y$2 + "px)",
			...getDPR(elements.floating) >= 1.5 && { willChange: "transform" }
		};
		return {
			position: strategy,
			left: x$2,
			top: y$2
		};
	}, [
		strategy,
		transform,
		elements.floating,
		data.x,
		data.y
	]);
	return import_react.useMemo(() => ({
		...data,
		update,
		refs,
		elements,
		floatingStyles
	}), [
		data,
		update,
		refs,
		elements,
		floatingStyles
	]);
}
var arrow$1$1 = (options) => {
	function isRef(value) {
		return {}.hasOwnProperty.call(value, "current");
	}
	return {
		name: "arrow",
		options,
		fn(state) {
			const { element, padding } = typeof options === "function" ? options(state) : options;
			if (element && isRef(element)) {
				if (element.current != null) return arrow$1({
					element: element.current,
					padding
				}).fn(state);
				return {};
			}
			if (element) return arrow$1({
				element,
				padding
			}).fn(state);
			return {};
		}
	};
};
var offset = (options, deps) => {
	const result = offset$1(options);
	return {
		name: result.name,
		fn: result.fn,
		options: [options, deps]
	};
};
var shift = (options, deps) => {
	const result = shift$1(options);
	return {
		name: result.name,
		fn: result.fn,
		options: [options, deps]
	};
};
var limitShift = (options, deps) => {
	return {
		fn: limitShift$1(options).fn,
		options: [options, deps]
	};
};
var flip = (options, deps) => {
	const result = flip$1(options);
	return {
		name: result.name,
		fn: result.fn,
		options: [options, deps]
	};
};
var size = (options, deps) => {
	const result = size$1(options);
	return {
		name: result.name,
		fn: result.fn,
		options: [options, deps]
	};
};
var hide = (options, deps) => {
	const result = hide$1(options);
	return {
		name: result.name,
		fn: result.fn,
		options: [options, deps]
	};
};
var arrow = (options, deps) => {
	const result = arrow$1$1(options);
	return {
		name: result.name,
		fn: result.fn,
		options: [options, deps]
	};
};
var __defProp$7 = Object.defineProperty;
var __name$7 = (target, value) => __defProp$7(target, "name", {
	value,
	configurable: true
});
function useSize(element) {
	const [size$3, setSize] = import_react.useState(void 0);
	useLayoutEffect2(() => {
		if (element) {
			setSize({
				width: element.offsetWidth,
				height: element.offsetHeight
			});
			const resizeObserver = new ResizeObserver((entries) => {
				if (!Array.isArray(entries)) return;
				if (!entries.length) return;
				const entry = entries[0];
				let width;
				let height;
				if ("borderBoxSize" in entry) {
					const borderSizeEntry = entry["borderBoxSize"];
					const borderSize = Array.isArray(borderSizeEntry) ? borderSizeEntry[0] : borderSizeEntry;
					width = borderSize["inlineSize"];
					height = borderSize["blockSize"];
				} else {
					width = element.offsetWidth;
					height = element.offsetHeight;
				}
				setSize({
					width,
					height
				});
			});
			resizeObserver.observe(element, { box: "border-box" });
			return () => resizeObserver.unobserve(element);
		} else setSize(void 0);
	}, [element]);
	return size$3;
}
__name$7(useSize, "useSize");
var __defProp$6 = Object.defineProperty;
var __name$6 = (target, value) => __defProp$6(target, "name", {
	value,
	configurable: true
});
var POPPER_NAME = "Popper";
var [createPopperContext, createPopperScope] = /* @__PURE__ */ createContextScope(POPPER_NAME);
var [PopperProvider, usePopperContext] = createPopperContext(POPPER_NAME);
var CONTENT_NAME$1 = "PopperContent";
var [PopperContentProvider, useContentContext] = createPopperContext(CONTENT_NAME$1);
var PopperContent = /* @__PURE__ */ import_react.forwardRef(/* @__PURE__ */ __name$6(function PopperContent2(props, forwardedRef) {
	const { __scopePopper, side = "bottom", sideOffset = 0, align = "center", alignOffset = 0, arrowPadding = 0, avoidCollisions = true, collisionBoundary = [], collisionPadding: collisionPaddingProp = 0, sticky = "partial", hideWhenDetached = false, updatePositionStrategy = "optimized", onPlaced, ...contentProps } = props;
	const context = usePopperContext(CONTENT_NAME$1, __scopePopper);
	const [content, setContent] = import_react.useState(null);
	const composedRefs = useComposedRefs(forwardedRef, setContent);
	const [arrow$3, setArrow] = import_react.useState(null);
	const arrowSize = useSize(arrow$3);
	const arrowWidth = arrowSize?.width ?? 0;
	const arrowHeight = arrowSize?.height ?? 0;
	const desiredPlacement = side + (align !== "center" ? "-" + align : "");
	const collisionPadding = typeof collisionPaddingProp === "number" ? collisionPaddingProp : {
		top: 0,
		right: 0,
		bottom: 0,
		left: 0,
		...collisionPaddingProp
	};
	const boundary = Array.isArray(collisionBoundary) ? collisionBoundary : [collisionBoundary];
	const hasExplicitBoundaries = boundary.length > 0;
	const detectOverflowOptions = {
		padding: collisionPadding,
		boundary: boundary.filter(isNotNull),
		altBoundary: hasExplicitBoundaries
	};
	const { refs, floatingStyles, placement, isPositioned, middlewareData } = useFloating({
		strategy: "fixed",
		placement: desiredPlacement,
		whileElementsMounted: /* @__PURE__ */ __name$6((...args) => {
			return autoUpdate(...args, { animationFrame: updatePositionStrategy === "always" });
		}, "whileElementsMounted"),
		elements: { reference: context.anchor },
		middleware: [
			offset({
				mainAxis: sideOffset + arrowHeight,
				alignmentAxis: alignOffset
			}),
			avoidCollisions && shift({
				mainAxis: true,
				crossAxis: false,
				limiter: sticky === "partial" ? limitShift() : void 0,
				...detectOverflowOptions
			}),
			avoidCollisions && flip({ ...detectOverflowOptions }),
			size({
				...detectOverflowOptions,
				apply: /* @__PURE__ */ __name$6(({ elements, rects, availableWidth, availableHeight }) => {
					const { width: anchorWidth, height: anchorHeight } = rects.reference;
					const contentStyle = elements.floating.style;
					contentStyle.setProperty("--radix-popper-available-width", `${availableWidth}px`);
					contentStyle.setProperty("--radix-popper-available-height", `${availableHeight}px`);
					contentStyle.setProperty("--radix-popper-anchor-width", `${anchorWidth}px`);
					contentStyle.setProperty("--radix-popper-anchor-height", `${anchorHeight}px`);
				}, "apply")
			}),
			arrow$3 && arrow({
				element: arrow$3,
				padding: arrowPadding
			}),
			transformOrigin({
				arrowWidth,
				arrowHeight
			}),
			hideWhenDetached && hide({
				strategy: "referenceHidden",
				...detectOverflowOptions,
				boundary: hasExplicitBoundaries ? detectOverflowOptions.boundary : void 0
			})
		]
	});
	const setPlacementState = context.setPlacementState;
	useLayoutEffect2(() => {
		setPlacementState(placement);
		return () => {
			setPlacementState(void 0);
		};
	}, [placement, setPlacementState]);
	const [placedSide, placedAlign] = getSideAndAlignFromPlacement(placement);
	const handlePlaced = useCallbackRef(onPlaced);
	useLayoutEffect2(() => {
		if (isPositioned) handlePlaced?.();
	}, [isPositioned, handlePlaced]);
	const arrowX = middlewareData.arrow?.x;
	const arrowY = middlewareData.arrow?.y;
	const cannotCenterArrow = middlewareData.arrow?.centerOffset !== 0;
	const [contentZIndex, setContentZIndex] = import_react.useState();
	useLayoutEffect2(() => {
		if (content) setContentZIndex(window.getComputedStyle(content).zIndex);
	}, [content]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		ref: refs.setFloating,
		"data-radix-popper-content-wrapper": "",
		style: {
			...floatingStyles,
			transform: isPositioned ? floatingStyles.transform : "translate(0, -200%)",
			minWidth: "max-content",
			zIndex: contentZIndex,
			"--radix-popper-transform-origin": [middlewareData.transformOrigin?.x, middlewareData.transformOrigin?.y].join(" "),
			...middlewareData.hide?.referenceHidden && {
				visibility: "hidden",
				pointerEvents: "none"
			}
		},
		dir: props.dir,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PopperContentProvider, {
			scope: __scopePopper,
			placedSide,
			placedAlign,
			onArrowChange: setArrow,
			arrowX,
			arrowY,
			shouldHideArrow: cannotCenterArrow,
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Primitive.div, {
				"data-side": placedSide,
				"data-align": placedAlign,
				...contentProps,
				ref: composedRefs,
				style: {
					...contentProps.style,
					animation: !isPositioned ? "none" : contentProps.style?.animation
				}
			})
		})
	});
}, "PopperContent"));
function isNotNull(value) {
	return value !== null;
}
__name$6(isNotNull, "isNotNull");
var transformOrigin = /* @__PURE__ */ __name$6((options) => ({
	name: "transformOrigin",
	options,
	fn(data) {
		const { placement, rects, middlewareData } = data;
		const isArrowHidden = middlewareData.arrow?.centerOffset !== 0;
		const arrowWidth = isArrowHidden ? 0 : options.arrowWidth;
		const arrowHeight = isArrowHidden ? 0 : options.arrowHeight;
		const [placedSide, placedAlign] = getSideAndAlignFromPlacement(placement);
		const noArrowAlign = {
			start: "0%",
			center: "50%",
			end: "100%"
		}[placedAlign];
		const arrowXCenter = (middlewareData.arrow?.x ?? 0) + arrowWidth / 2;
		const arrowYCenter = (middlewareData.arrow?.y ?? 0) + arrowHeight / 2;
		let x$2 = "";
		let y$2 = "";
		if (placedSide === "bottom") {
			x$2 = isArrowHidden ? noArrowAlign : `${arrowXCenter}px`;
			y$2 = `${-arrowHeight}px`;
		} else if (placedSide === "top") {
			x$2 = isArrowHidden ? noArrowAlign : `${arrowXCenter}px`;
			y$2 = `${rects.floating.height + arrowHeight}px`;
		} else if (placedSide === "right") {
			x$2 = `${-arrowHeight}px`;
			y$2 = isArrowHidden ? noArrowAlign : `${arrowYCenter}px`;
		} else if (placedSide === "left") {
			x$2 = `${rects.floating.width + arrowHeight}px`;
			y$2 = isArrowHidden ? noArrowAlign : `${arrowYCenter}px`;
		}
		return { data: {
			x: x$2,
			y: y$2
		} };
	}
}), "transformOrigin");
function getSideAndAlignFromPlacement(placement) {
	const [side, align = "center"] = placement.split("-");
	return [side, align];
}
__name$6(getSideAndAlignFromPlacement, "getSideAndAlignFromPlacement");
var Content = PopperContent;
var import_react_dom = /* @__PURE__ */ __toESM(require_react_dom(), 1);
var __defProp$5 = Object.defineProperty;
var __name$5 = (target, value) => __defProp$5(target, "name", {
	value,
	configurable: true
});
var Portal = /* @__PURE__ */ import_react.forwardRef(/* @__PURE__ */ __name$5(function Portal2(props, forwardedRef) {
	const { container: containerProp, ...portalProps } = props;
	const [mounted, setMounted] = import_react.useState(false);
	useLayoutEffect2(() => setMounted(true), []);
	const container = containerProp || mounted && globalThis?.document?.body;
	return container ? import_react_dom.createPortal(/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Primitive.div, {
		...portalProps,
		ref: forwardedRef
	}), container) : null;
}, "Portal"));
var __defProp$4 = Object.defineProperty;
var __name$4 = (target, value) => __defProp$4(target, "name", {
	value,
	configurable: true
});
function useStateMachine(initialState, machine) {
	return import_react.useReducer((state, event) => {
		return machine[state][event] ?? state;
	}, initialState);
}
__name$4(useStateMachine, "useStateMachine");
var Presence = /* @__PURE__ */ __name$4((props) => {
	const { present, children } = props;
	const presence = usePresence(present);
	const child = typeof children === "function" ? children({ present: presence.isPresent }) : import_react.Children.only(children);
	const ref = useStableComposedRefs(presence.ref, getElementRef(child));
	return typeof children === "function" || presence.isPresent ? import_react.cloneElement(child, { ref }) : null;
}, "Presence");
function usePresence(present) {
	const [node, setNode] = import_react.useState();
	const stylesRef = import_react.useRef(null);
	const prevPresentRef = import_react.useRef(present);
	const prevAnimationNameRef = import_react.useRef("none");
	const mountAnimationNameRef = import_react.useRef(void 0);
	const [state, send] = useStateMachine(present ? "mounted" : "unmounted", {
		mounted: {
			UNMOUNT: "unmounted",
			ANIMATION_OUT: "unmountSuspended"
		},
		unmountSuspended: {
			MOUNT: "mounted",
			ANIMATION_END: "unmounted"
		},
		unmounted: { MOUNT: "mounted" }
	});
	import_react.useEffect(() => {
		if (state === "mounted") {
			prevAnimationNameRef.current = mountAnimationNameRef.current ?? getAnimationName(stylesRef.current);
			mountAnimationNameRef.current = void 0;
		} else prevAnimationNameRef.current = "none";
	}, [state]);
	useLayoutEffect2(() => {
		const styles = stylesRef.current;
		const wasPresent = prevPresentRef.current;
		if (wasPresent !== present) {
			const prevAnimationName = prevAnimationNameRef.current;
			const currentAnimationName = getAnimationName(styles);
			if (present) {
				mountAnimationNameRef.current = currentAnimationName;
				send("MOUNT");
			} else if (currentAnimationName === "none" || styles?.display === "none") send("UNMOUNT");
			else if (wasPresent && prevAnimationName !== currentAnimationName) send("ANIMATION_OUT");
			else send("UNMOUNT");
			prevPresentRef.current = present;
		}
	}, [present, send]);
	useLayoutEffect2(() => {
		if (node) {
			let timeoutId;
			const ownerWindow = node.ownerDocument.defaultView ?? window;
			const handleAnimationEnd = /* @__PURE__ */ __name$4((event) => {
				const isCurrentAnimation = getAnimationName(stylesRef.current).includes(CSS.escape(event.animationName));
				if (event.target === node && isCurrentAnimation) {
					send("ANIMATION_END");
					if (!prevPresentRef.current) {
						const currentFillMode = node.style.animationFillMode;
						node.style.animationFillMode = "forwards";
						timeoutId = ownerWindow.setTimeout(() => {
							if (node.style.animationFillMode === "forwards") node.style.animationFillMode = currentFillMode;
						});
					}
				}
			}, "handleAnimationEnd");
			const handleAnimationStart = /* @__PURE__ */ __name$4((event) => {
				if (event.target === node) prevAnimationNameRef.current = getAnimationName(stylesRef.current);
			}, "handleAnimationStart");
			node.addEventListener("animationstart", handleAnimationStart);
			node.addEventListener("animationcancel", handleAnimationEnd);
			node.addEventListener("animationend", handleAnimationEnd);
			return () => {
				ownerWindow.clearTimeout(timeoutId);
				node.removeEventListener("animationstart", handleAnimationStart);
				node.removeEventListener("animationcancel", handleAnimationEnd);
				node.removeEventListener("animationend", handleAnimationEnd);
			};
		} else send("ANIMATION_END");
	}, [node, send]);
	return {
		isPresent: ["mounted", "unmountSuspended"].includes(state),
		ref: import_react.useCallback((node2) => {
			if (node2) {
				const styles = getComputedStyle(node2);
				stylesRef.current = styles;
				mountAnimationNameRef.current = getAnimationName(styles);
			} else stylesRef.current = null;
			setNode(node2);
		}, [])
	};
}
__name$4(usePresence, "usePresence");
function setRef(ref, value) {
	if (typeof ref === "function") return ref(value);
	else if (ref !== null && ref !== void 0) ref.current = value;
}
__name$4(setRef, "setRef");
function useStableComposedRefs(...refs) {
	const refsRef = import_react.useRef(refs);
	refsRef.current = refs;
	return import_react.useCallback((node) => {
		const currentRefs = refsRef.current;
		let hasCleanup = false;
		const cleanups = currentRefs.map((ref) => {
			const cleanup = setRef(ref, node);
			if (!hasCleanup && typeof cleanup === "function") hasCleanup = true;
			return cleanup;
		});
		if (hasCleanup) return () => {
			for (let i = 0; i < cleanups.length; i++) {
				const cleanup = cleanups[i];
				if (typeof cleanup === "function") cleanup();
				else setRef(currentRefs[i], null);
			}
		};
	}, []);
}
__name$4(useStableComposedRefs, "useStableComposedRefs");
function getAnimationName(styles) {
	return styles?.animationName || "none";
}
__name$4(getAnimationName, "getAnimationName");
function getElementRef(element) {
	let getter = Object.getOwnPropertyDescriptor(element.props, "ref")?.get;
	let mayWarn = getter && "isReactWarning" in getter && getter.isReactWarning;
	if (mayWarn) return element.ref;
	getter = Object.getOwnPropertyDescriptor(element, "ref")?.get;
	mayWarn = getter && "isReactWarning" in getter && getter.isReactWarning;
	if (mayWarn) return element.props.ref;
	return element.props.ref || element.ref;
}
__name$4(getElementRef, "getElementRef");
var __defProp$3 = Object.defineProperty;
var __name$3 = (target, value) => __defProp$3(target, "name", {
	value,
	configurable: true
});
var useReactEffectEvent = import_react[" useEffectEvent ".trim().toString()];
var useReactInsertionEffect = import_react[" useInsertionEffect ".trim().toString()];
function useEffectEvent(callback) {
	if (typeof useReactEffectEvent === "function") return useReactEffectEvent(callback);
	const ref = import_react.useRef(() => {
		throw new Error("Cannot call an event handler while rendering.");
	});
	if (typeof useReactInsertionEffect === "function") useReactInsertionEffect(() => {
		ref.current = callback;
	});
	else useLayoutEffect2(() => {
		ref.current = callback;
	});
	return import_react.useMemo(() => ((...args) => ref.current?.(...args)), []);
}
__name$3(useEffectEvent, "useEffectEvent");
var __defProp$2 = Object.defineProperty;
var __name$2 = (target, value) => __defProp$2(target, "name", {
	value,
	configurable: true
});
var useInsertionEffect = import_react[" useInsertionEffect ".trim().toString()] || useLayoutEffect2;
function useControllableState({ prop, defaultProp, onChange = /* @__PURE__ */ __name$2(() => {}, "onChange"), caller }) {
	const [uncontrolledProp, setUncontrolledProp, onChangeRef] = useUncontrolledState({
		defaultProp,
		onChange
	});
	const isControlled = prop !== void 0;
	return [isControlled ? prop : uncontrolledProp, import_react.useCallback((nextValue) => {
		if (isControlled) {
			const value2 = isFunction(nextValue) ? nextValue(prop) : nextValue;
			if (value2 !== prop) onChangeRef.current?.(value2);
		} else setUncontrolledProp(nextValue);
	}, [
		isControlled,
		prop,
		setUncontrolledProp,
		onChangeRef
	])];
}
__name$2(useControllableState, "useControllableState");
function useUncontrolledState({ defaultProp, onChange }) {
	const [value, setValue] = import_react.useState(defaultProp);
	const prevValueRef = import_react.useRef(value);
	const onChangeRef = import_react.useRef(onChange);
	useInsertionEffect(() => {
		onChangeRef.current = onChange;
	}, [onChange]);
	import_react.useEffect(() => {
		if (prevValueRef.current !== value) {
			onChangeRef.current?.(value);
			prevValueRef.current = value;
		}
	}, [value, prevValueRef]);
	return [
		value,
		setValue,
		onChangeRef
	];
}
__name$2(useUncontrolledState, "useUncontrolledState");
function isFunction(value) {
	return typeof value === "function";
}
__name$2(isFunction, "isFunction");
var SYNC_STATE = Symbol("RADIX:SYNC_STATE");
function useControllableStateReducer(reducer, userArgs, initialArg, init$2) {
	const { prop: controlledState, defaultProp, onChange: onChangeProp, caller } = userArgs;
	const isControlled = controlledState !== void 0;
	const onChange = useEffectEvent(onChangeProp);
	const args = [{
		...initialArg,
		state: defaultProp
	}];
	if (init$2) args.push(init$2);
	const [internalState, dispatch] = import_react.useReducer((state2, action) => {
		if (action.type === SYNC_STATE) return {
			...state2,
			state: action.state
		};
		const next = reducer(state2, action);
		if (isControlled && !Object.is(next.state, state2.state)) onChange(next.state);
		return next;
	}, ...args);
	const uncontrolledState = internalState.state;
	const prevValueRef = import_react.useRef(uncontrolledState);
	import_react.useEffect(() => {
		if (prevValueRef.current !== uncontrolledState) {
			prevValueRef.current = uncontrolledState;
			if (!isControlled) onChange(uncontrolledState);
		}
	}, [
		uncontrolledState,
		prevValueRef,
		isControlled
	]);
	const state = import_react.useMemo(() => {
		if (controlledState !== void 0) return {
			...internalState,
			state: controlledState
		};
		return internalState;
	}, [internalState, controlledState]);
	import_react.useEffect(() => {
		if (isControlled && !Object.is(controlledState, internalState.state)) dispatch({
			type: SYNC_STATE,
			state: controlledState
		});
	}, [
		controlledState,
		internalState.state,
		isControlled
	]);
	return [state, dispatch];
}
__name$2(useControllableStateReducer, "useControllableStateReducer");
var __defProp$1 = Object.defineProperty;
var __name$1 = (target, value) => __defProp$1(target, "name", {
	value,
	configurable: true
});
var VISUALLY_HIDDEN_STYLES = Object.freeze({
	position: "absolute",
	border: 0,
	width: 1,
	height: 1,
	padding: 0,
	margin: -1,
	overflow: "hidden",
	clip: "rect(0, 0, 0, 0)",
	whiteSpace: "nowrap",
	wordWrap: "normal"
});
var Root = /* @__PURE__ */ import_react.forwardRef(/* @__PURE__ */ __name$1(function VisuallyHidden2(props, forwardedRef) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Primitive.span, {
		...props,
		ref: forwardedRef,
		style: {
			...VISUALLY_HIDDEN_STYLES,
			...props.style
		}
	});
}, "VisuallyHidden"));
var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", {
	value,
	configurable: true
});
var [createTooltipContext, createTooltipScope] = /* @__PURE__ */ createContextScope("Tooltip", [createPopperScope]);
var usePopperScope = createPopperScope();
var PROVIDER_NAME = "TooltipProvider";
var DEFAULT_DELAY_DURATION = 700;
var TOOLTIP_OPEN = "tooltip.open";
var [TooltipProviderContextProvider, useTooltipProviderContext] = createTooltipContext(PROVIDER_NAME);
var TooltipProvider$1 = /* @__PURE__ */ __name((props) => {
	const { __scopeTooltip, delayDuration = DEFAULT_DELAY_DURATION, skipDelayDuration = 300, disableHoverableContent = false, children } = props;
	const isOpenDelayedRef = import_react.useRef(true);
	const isPointerInTransitRef = import_react.useRef(false);
	const skipDelayTimerRef = import_react.useRef(0);
	import_react.useEffect(() => {
		const skipDelayTimer = skipDelayTimerRef.current;
		return () => window.clearTimeout(skipDelayTimer);
	}, []);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TooltipProviderContextProvider, {
		scope: __scopeTooltip,
		isOpenDelayedRef,
		delayDuration,
		onOpen: import_react.useCallback(() => {
			if (skipDelayDuration <= 0) return;
			window.clearTimeout(skipDelayTimerRef.current);
			isOpenDelayedRef.current = false;
		}, [skipDelayDuration]),
		onClose: import_react.useCallback(() => {
			if (skipDelayDuration <= 0) return;
			window.clearTimeout(skipDelayTimerRef.current);
			skipDelayTimerRef.current = window.setTimeout(() => isOpenDelayedRef.current = true, skipDelayDuration);
		}, [skipDelayDuration]),
		isPointerInTransitRef,
		onPointerInTransitChange: import_react.useCallback((inTransit) => {
			isPointerInTransitRef.current = inTransit;
		}, []),
		disableHoverableContent,
		children
	});
}, "TooltipProvider");
var [TooltipContextProvider, useTooltipContext] = createTooltipContext("Tooltip");
var PORTAL_NAME = "TooltipPortal";
var [PortalProvider, usePortalContext] = createTooltipContext(PORTAL_NAME, { forceMount: void 0 });
var TooltipPortal = /* @__PURE__ */ __name((props) => {
	const { __scopeTooltip, forceMount, children, container } = props;
	const context = useTooltipContext(PORTAL_NAME, __scopeTooltip);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PortalProvider, {
		scope: __scopeTooltip,
		forceMount,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Presence, {
			present: forceMount || context.open,
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Portal, {
				asChild: true,
				container,
				children
			})
		})
	});
}, "TooltipPortal");
var CONTENT_NAME = "TooltipContent";
var TooltipContent$1 = /* @__PURE__ */ import_react.forwardRef(/* @__PURE__ */ __name(function TooltipContent2(props, forwardedRef) {
	const portalContext = usePortalContext(CONTENT_NAME, props.__scopeTooltip);
	const { forceMount = portalContext.forceMount, side = "top", ...contentProps } = props;
	const context = useTooltipContext(CONTENT_NAME, props.__scopeTooltip);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Presence, {
		present: forceMount || context.open,
		children: context.disableHoverableContent ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TooltipContentImpl, {
			side,
			...contentProps,
			ref: forwardedRef
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TooltipContentHoverable, {
			side,
			...contentProps,
			ref: forwardedRef
		})
	});
}, "TooltipContent"));
var TooltipContentHoverable = /* @__PURE__ */ import_react.forwardRef(/* @__PURE__ */ __name(function TooltipContentHoverable2(props, forwardedRef) {
	const context = useTooltipContext(CONTENT_NAME, props.__scopeTooltip);
	const providerContext = useTooltipProviderContext(CONTENT_NAME, props.__scopeTooltip);
	const ref = import_react.useRef(null);
	const composedRefs = useComposedRefs(forwardedRef, ref);
	const [pointerGraceArea, setPointerGraceArea] = import_react.useState(null);
	const { trigger, onClose } = context;
	const content = ref.current;
	const { onPointerInTransitChange } = providerContext;
	const handleRemoveGraceArea = import_react.useCallback(() => {
		setPointerGraceArea(null);
		onPointerInTransitChange(false);
	}, [onPointerInTransitChange]);
	const handleCreateGraceArea = import_react.useCallback((event, hoverTarget) => {
		const currentTarget = event.currentTarget;
		const exitPoint = {
			x: event.clientX,
			y: event.clientY
		};
		const paddedExitPoints = getPaddedExitPoints(exitPoint, getExitSideFromRect(exitPoint, currentTarget.getBoundingClientRect()));
		const hoverTargetPoints = getPointsFromRect(hoverTarget.getBoundingClientRect());
		setPointerGraceArea(getHull([...paddedExitPoints, ...hoverTargetPoints]));
		onPointerInTransitChange(true);
	}, [onPointerInTransitChange]);
	import_react.useEffect(() => {
		return () => handleRemoveGraceArea();
	}, [handleRemoveGraceArea]);
	import_react.useEffect(() => {
		if (trigger && content) {
			const handleTriggerLeave = /* @__PURE__ */ __name((event) => handleCreateGraceArea(event, content), "handleTriggerLeave");
			const handleContentLeave = /* @__PURE__ */ __name((event) => handleCreateGraceArea(event, trigger), "handleContentLeave");
			trigger.addEventListener("pointerleave", handleTriggerLeave);
			content.addEventListener("pointerleave", handleContentLeave);
			return () => {
				trigger.removeEventListener("pointerleave", handleTriggerLeave);
				content.removeEventListener("pointerleave", handleContentLeave);
			};
		}
	}, [
		trigger,
		content,
		handleCreateGraceArea,
		handleRemoveGraceArea
	]);
	import_react.useEffect(() => {
		if (pointerGraceArea) {
			const handleTrackPointerGrace = /* @__PURE__ */ __name((event) => {
				const target = event.target;
				const pointerPosition = {
					x: event.clientX,
					y: event.clientY
				};
				const hasEnteredTarget = trigger?.contains(target) || content?.contains(target);
				const isPointerOutsideGraceArea = !isPointInPolygon(pointerPosition, pointerGraceArea);
				if (hasEnteredTarget) handleRemoveGraceArea();
				else if (isPointerOutsideGraceArea) {
					handleRemoveGraceArea();
					onClose();
				}
			}, "handleTrackPointerGrace");
			document.addEventListener("pointermove", handleTrackPointerGrace);
			return () => document.removeEventListener("pointermove", handleTrackPointerGrace);
		}
	}, [
		trigger,
		content,
		pointerGraceArea,
		onClose,
		handleRemoveGraceArea
	]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TooltipContentImpl, {
		...props,
		ref: composedRefs
	});
}, "TooltipContentHoverable"));
var Slottable = /* @__PURE__ */ createSlottable("TooltipContent");
var TooltipContentImpl = /* @__PURE__ */ import_react.forwardRef(/* @__PURE__ */ __name(function TooltipContentImpl2(props, forwardedRef) {
	const { __scopeTooltip, children, "aria-label": ariaLabel, id: idProp, onEscapeKeyDown, onPointerDownOutside, ...contentProps } = props;
	const context = useTooltipContext(CONTENT_NAME, __scopeTooltip);
	const popperScope = usePopperScope(__scopeTooltip);
	const { onClose } = context;
	import_react.useEffect(() => {
		document.addEventListener(TOOLTIP_OPEN, onClose);
		return () => document.removeEventListener(TOOLTIP_OPEN, onClose);
	}, [onClose]);
	import_react.useEffect(() => {
		if (context.trigger) {
			const handleScroll = /* @__PURE__ */ __name((event) => {
				if (event.target instanceof Node && event.target.contains(context.trigger)) onClose();
			}, "handleScroll");
			window.addEventListener("scroll", handleScroll, { capture: true });
			return () => window.removeEventListener("scroll", handleScroll, { capture: true });
		}
	}, [context.trigger, onClose]);
	const { setContentId } = context;
	useLayoutEffect2(() => {
		setContentId(idProp);
		return () => {
			setContentId(void 0);
		};
	}, [idProp, setContentId]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DismissableLayer, {
		asChild: true,
		disableOutsidePointerEvents: false,
		onEscapeKeyDown,
		onPointerDownOutside,
		onFocusOutside: (event) => event.preventDefault(),
		onDismiss: onClose,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Content, {
			"data-state": context.stateAttribute,
			role: ariaLabel ? void 0 : "tooltip",
			id: ariaLabel ? void 0 : context.contentId,
			...popperScope,
			...contentProps,
			ref: forwardedRef,
			style: {
				...contentProps.style,
				"--radix-tooltip-content-transform-origin": "var(--radix-popper-transform-origin)",
				"--radix-tooltip-content-available-width": "var(--radix-popper-available-width)",
				"--radix-tooltip-content-available-height": "var(--radix-popper-available-height)",
				"--radix-tooltip-trigger-width": "var(--radix-popper-anchor-width)",
				"--radix-tooltip-trigger-height": "var(--radix-popper-anchor-height)"
			},
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Slottable, { children }), ariaLabel ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Root, {
				id: context.contentId,
				role: "tooltip",
				children: ariaLabel
			}) : null]
		})
	});
}, "TooltipContentImpl"));
function getExitSideFromRect(point, rect) {
	const top = Math.abs(rect.top - point.y);
	const bottom = Math.abs(rect.bottom - point.y);
	const right = Math.abs(rect.right - point.x);
	const left = Math.abs(rect.left - point.x);
	switch (Math.min(top, bottom, right, left)) {
		case left: return "left";
		case right: return "right";
		case top: return "top";
		case bottom: return "bottom";
		default: throw new Error("unreachable");
	}
}
__name(getExitSideFromRect, "getExitSideFromRect");
function getPaddedExitPoints(exitPoint, exitSide, padding = 5) {
	const paddedExitPoints = [];
	switch (exitSide) {
		case "top":
			paddedExitPoints.push({
				x: exitPoint.x - padding,
				y: exitPoint.y + padding
			}, {
				x: exitPoint.x + padding,
				y: exitPoint.y + padding
			});
			break;
		case "bottom":
			paddedExitPoints.push({
				x: exitPoint.x - padding,
				y: exitPoint.y - padding
			}, {
				x: exitPoint.x + padding,
				y: exitPoint.y - padding
			});
			break;
		case "left":
			paddedExitPoints.push({
				x: exitPoint.x + padding,
				y: exitPoint.y - padding
			}, {
				x: exitPoint.x + padding,
				y: exitPoint.y + padding
			});
			break;
		case "right":
			paddedExitPoints.push({
				x: exitPoint.x - padding,
				y: exitPoint.y - padding
			}, {
				x: exitPoint.x - padding,
				y: exitPoint.y + padding
			});
			break;
	}
	return paddedExitPoints;
}
__name(getPaddedExitPoints, "getPaddedExitPoints");
function getPointsFromRect(rect) {
	const { top, right, bottom, left } = rect;
	return [
		{
			x: left,
			y: top
		},
		{
			x: right,
			y: top
		},
		{
			x: right,
			y: bottom
		},
		{
			x: left,
			y: bottom
		}
	];
}
__name(getPointsFromRect, "getPointsFromRect");
function isPointInPolygon(point, polygon) {
	const { x: x$2, y: y$2 } = point;
	let inside = false;
	for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
		const ii$1 = polygon[i];
		const jj$1 = polygon[j];
		const xi$1 = ii$1.x;
		const yi$1 = ii$1.y;
		const xj$1 = jj$1.x;
		const yj$1 = jj$1.y;
		if (yi$1 > y$2 !== yj$1 > y$2 && x$2 < (xj$1 - xi$1) * (y$2 - yi$1) / (yj$1 - yi$1) + xi$1) inside = !inside;
	}
	return inside;
}
__name(isPointInPolygon, "isPointInPolygon");
function getHull(points) {
	const newPoints = points.slice();
	newPoints.sort((a, b$1) => {
		if (a.x < b$1.x) return -1;
		else if (a.x > b$1.x) return 1;
		else if (a.y < b$1.y) return -1;
		else if (a.y > b$1.y) return 1;
		else return 0;
	});
	return getHullPresorted(newPoints);
}
__name(getHull, "getHull");
function getHullPresorted(points) {
	if (points.length <= 1) return points.slice();
	const upperHull = [];
	for (let i = 0; i < points.length; i++) {
		const p$4 = points[i];
		while (upperHull.length >= 2) {
			const q$3 = upperHull[upperHull.length - 1];
			const r$3 = upperHull[upperHull.length - 2];
			if ((q$3.x - r$3.x) * (p$4.y - r$3.y) >= (q$3.y - r$3.y) * (p$4.x - r$3.x)) upperHull.pop();
			else break;
		}
		upperHull.push(p$4);
	}
	upperHull.pop();
	const lowerHull = [];
	for (let i = points.length - 1; i >= 0; i--) {
		const p$4 = points[i];
		while (lowerHull.length >= 2) {
			const q$3 = lowerHull[lowerHull.length - 1];
			const r$3 = lowerHull[lowerHull.length - 2];
			if ((q$3.x - r$3.x) * (p$4.y - r$3.y) >= (q$3.y - r$3.y) * (p$4.x - r$3.x)) lowerHull.pop();
			else break;
		}
		lowerHull.push(p$4);
	}
	lowerHull.pop();
	if (upperHull.length === 1 && lowerHull.length === 1 && upperHull[0].x === lowerHull[0].x && upperHull[0].y === lowerHull[0].y) return upperHull;
	else return upperHull.concat(lowerHull);
}
__name(getHullPresorted, "getHullPresorted");
var Provider = TooltipProvider$1;
var Portal$1 = TooltipPortal;
var Content2 = TooltipContent$1;
function r(e) {
	var t$2, f$2, n$2 = "";
	if ("string" == typeof e || "number" == typeof e) n$2 += e;
	else if ("object" == typeof e) if (Array.isArray(e)) {
		var o = e.length;
		for (t$2 = 0; t$2 < o; t$2++) e[t$2] && (f$2 = r(e[t$2])) && (n$2 && (n$2 += " "), n$2 += f$2);
	} else for (f$2 in e) e[f$2] && (n$2 && (n$2 += " "), n$2 += f$2);
	return n$2;
}
function clsx() {
	for (var e, t$2, f$2 = 0, n$2 = "", o = arguments.length; f$2 < o; f$2++) (e = arguments[f$2]) && (t$2 = r(e)) && (n$2 && (n$2 += " "), n$2 += t$2);
	return n$2;
}
var concatArrays = (array1, array2) => {
	const combinedArray = new Array(array1.length + array2.length);
	for (let i = 0; i < array1.length; i++) combinedArray[i] = array1[i];
	for (let i = 0; i < array2.length; i++) combinedArray[array1.length + i] = array2[i];
	return combinedArray;
};
var createClassValidatorObject = (classGroupId, validator) => ({
	classGroupId,
	validator
});
var createClassPartObject = (nextPart = /* @__PURE__ */ new Map(), validators = null, classGroupId) => ({
	nextPart,
	validators,
	classGroupId
});
var CLASS_PART_SEPARATOR = "-";
var EMPTY_CONFLICTS = [];
var ARBITRARY_PROPERTY_PREFIX = "arbitrary..";
var createClassGroupUtils = (config) => {
	const classMap = createClassMap(config);
	const { conflictingClassGroups, conflictingClassGroupModifiers } = config;
	const getClassGroupId = (className) => {
		if (className.startsWith("[") && className.endsWith("]")) return getGroupIdForArbitraryProperty(className);
		const classParts = className.split(CLASS_PART_SEPARATOR);
		return getGroupRecursive(classParts, classParts[0] === "" && classParts.length > 1 ? 1 : 0, classMap);
	};
	const getConflictingClassGroupIds = (classGroupId, hasPostfixModifier) => {
		if (hasPostfixModifier) {
			const modifierConflicts = conflictingClassGroupModifiers[classGroupId];
			const baseConflicts = conflictingClassGroups[classGroupId];
			if (modifierConflicts) {
				if (baseConflicts) return concatArrays(baseConflicts, modifierConflicts);
				return modifierConflicts;
			}
			return baseConflicts || EMPTY_CONFLICTS;
		}
		return conflictingClassGroups[classGroupId] || EMPTY_CONFLICTS;
	};
	return {
		getClassGroupId,
		getConflictingClassGroupIds
	};
};
var getGroupRecursive = (classParts, startIndex, classPartObject) => {
	if (classParts.length - startIndex === 0) return classPartObject.classGroupId;
	const currentClassPart = classParts[startIndex];
	const nextClassPartObject = classPartObject.nextPart.get(currentClassPart);
	if (nextClassPartObject) {
		const result = getGroupRecursive(classParts, startIndex + 1, nextClassPartObject);
		if (result) return result;
	}
	const validators = classPartObject.validators;
	if (validators === null) return;
	const classRest = startIndex === 0 ? classParts.join(CLASS_PART_SEPARATOR) : classParts.slice(startIndex).join(CLASS_PART_SEPARATOR);
	const validatorsLength = validators.length;
	for (let i = 0; i < validatorsLength; i++) {
		const validatorObj = validators[i];
		if (validatorObj.validator(classRest)) return validatorObj.classGroupId;
	}
};
var getGroupIdForArbitraryProperty = (className) => className.slice(1, -1).indexOf(":") === -1 ? void 0 : (() => {
	const content = className.slice(1, -1);
	const colonIndex = content.indexOf(":");
	const property = content.slice(0, colonIndex);
	return property ? ARBITRARY_PROPERTY_PREFIX + property : void 0;
})();
var createClassMap = (config) => {
	const { theme, classGroups } = config;
	return processClassGroups(classGroups, theme);
};
var processClassGroups = (classGroups, theme) => {
	const classMap = createClassPartObject();
	for (const classGroupId in classGroups) {
		const group = classGroups[classGroupId];
		processClassesRecursively(group, classMap, classGroupId, theme);
	}
	return classMap;
};
var processClassesRecursively = (classGroup, classPartObject, classGroupId, theme) => {
	const len = classGroup.length;
	for (let i = 0; i < len; i++) {
		const classDefinition = classGroup[i];
		processClassDefinition(classDefinition, classPartObject, classGroupId, theme);
	}
};
var processClassDefinition = (classDefinition, classPartObject, classGroupId, theme) => {
	if (typeof classDefinition === "string") {
		processStringDefinition(classDefinition, classPartObject, classGroupId);
		return;
	}
	if (typeof classDefinition === "function") {
		processFunctionDefinition(classDefinition, classPartObject, classGroupId, theme);
		return;
	}
	processObjectDefinition(classDefinition, classPartObject, classGroupId, theme);
};
var processStringDefinition = (classDefinition, classPartObject, classGroupId) => {
	const classPartObjectToEdit = classDefinition === "" ? classPartObject : getPart(classPartObject, classDefinition);
	classPartObjectToEdit.classGroupId = classGroupId;
};
var processFunctionDefinition = (classDefinition, classPartObject, classGroupId, theme) => {
	if (isThemeGetter(classDefinition)) {
		processClassesRecursively(classDefinition(theme), classPartObject, classGroupId, theme);
		return;
	}
	if (classPartObject.validators === null) classPartObject.validators = [];
	classPartObject.validators.push(createClassValidatorObject(classGroupId, classDefinition));
};
var processObjectDefinition = (classDefinition, classPartObject, classGroupId, theme) => {
	const entries = Object.entries(classDefinition);
	const len = entries.length;
	for (let i = 0; i < len; i++) {
		const [key, value] = entries[i];
		processClassesRecursively(value, getPart(classPartObject, key), classGroupId, theme);
	}
};
var getPart = (classPartObject, path) => {
	let current = classPartObject;
	const parts = path.split(CLASS_PART_SEPARATOR);
	const len = parts.length;
	for (let i = 0; i < len; i++) {
		const part = parts[i];
		let next = current.nextPart.get(part);
		if (!next) {
			next = createClassPartObject();
			current.nextPart.set(part, next);
		}
		current = next;
	}
	return current;
};
var isThemeGetter = (func) => "isThemeGetter" in func && func.isThemeGetter === true;
var createLruCache = (maxCacheSize) => {
	if (maxCacheSize < 1) return {
		get: () => void 0,
		set: () => {}
	};
	let cacheSize = 0;
	let cache = Object.create(null);
	let previousCache = Object.create(null);
	const update = (key, value) => {
		cache[key] = value;
		cacheSize++;
		if (cacheSize > maxCacheSize) {
			cacheSize = 0;
			previousCache = cache;
			cache = Object.create(null);
		}
	};
	return {
		get(key) {
			let value = cache[key];
			if (value !== void 0) return value;
			if ((value = previousCache[key]) !== void 0) {
				update(key, value);
				return value;
			}
		},
		set(key, value) {
			if (key in cache) cache[key] = value;
			else update(key, value);
		}
	};
};
var IMPORTANT_MODIFIER = "!";
var MODIFIER_SEPARATOR = ":";
var EMPTY_MODIFIERS = [];
var createResultObject = (modifiers, hasImportantModifier, baseClassName, maybePostfixModifierPosition, isExternal) => ({
	modifiers,
	hasImportantModifier,
	baseClassName,
	maybePostfixModifierPosition,
	isExternal
});
var createParseClassName = (config) => {
	const { prefix, experimentalParseClassName } = config;
	let parseClassName = (className) => {
		const modifiers = [];
		let bracketDepth = 0;
		let parenDepth = 0;
		let modifierStart = 0;
		let postfixModifierPosition;
		const len = className.length;
		for (let index$1 = 0; index$1 < len; index$1++) {
			const currentCharacter = className[index$1];
			if (bracketDepth === 0 && parenDepth === 0) {
				if (currentCharacter === MODIFIER_SEPARATOR) {
					modifiers.push(className.slice(modifierStart, index$1));
					modifierStart = index$1 + 1;
					continue;
				}
				if (currentCharacter === "/") {
					postfixModifierPosition = index$1;
					continue;
				}
			}
			if (currentCharacter === "[") bracketDepth++;
			else if (currentCharacter === "]") bracketDepth--;
			else if (currentCharacter === "(") parenDepth++;
			else if (currentCharacter === ")") parenDepth--;
		}
		const baseClassNameWithImportantModifier = modifiers.length === 0 ? className : className.slice(modifierStart);
		let baseClassName = baseClassNameWithImportantModifier;
		let hasImportantModifier = false;
		if (baseClassNameWithImportantModifier.endsWith(IMPORTANT_MODIFIER)) {
			baseClassName = baseClassNameWithImportantModifier.slice(0, -1);
			hasImportantModifier = true;
		} else if (baseClassNameWithImportantModifier.startsWith(IMPORTANT_MODIFIER)) {
			baseClassName = baseClassNameWithImportantModifier.slice(1);
			hasImportantModifier = true;
		}
		const maybePostfixModifierPosition = postfixModifierPosition && postfixModifierPosition > modifierStart ? postfixModifierPosition - modifierStart : void 0;
		return createResultObject(modifiers, hasImportantModifier, baseClassName, maybePostfixModifierPosition);
	};
	if (prefix) {
		const fullPrefix = prefix + MODIFIER_SEPARATOR;
		const parseClassNameOriginal = parseClassName;
		parseClassName = (className) => className.startsWith(fullPrefix) ? parseClassNameOriginal(className.slice(fullPrefix.length)) : createResultObject(EMPTY_MODIFIERS, false, className, void 0, true);
	}
	if (experimentalParseClassName) {
		const parseClassNameOriginal = parseClassName;
		parseClassName = (className) => experimentalParseClassName({
			className,
			parseClassName: parseClassNameOriginal
		});
	}
	return parseClassName;
};
var createSortModifiers = (config) => {
	const modifierWeights = /* @__PURE__ */ new Map();
	config.orderSensitiveModifiers.forEach((mod, index$1) => {
		modifierWeights.set(mod, 1e6 + index$1);
	});
	return (modifiers) => {
		const result = [];
		let currentSegment = [];
		for (let i = 0; i < modifiers.length; i++) {
			const modifier = modifiers[i];
			const isArbitrary = modifier[0] === "[";
			const isOrderSensitive = modifierWeights.has(modifier);
			if (isArbitrary || isOrderSensitive) {
				if (currentSegment.length > 0) {
					currentSegment.sort();
					result.push(...currentSegment);
					currentSegment = [];
				}
				result.push(modifier);
			} else currentSegment.push(modifier);
		}
		if (currentSegment.length > 0) {
			currentSegment.sort();
			result.push(...currentSegment);
		}
		return result;
	};
};
var createConfigUtils = (config) => ({
	cache: createLruCache(config.cacheSize),
	parseClassName: createParseClassName(config),
	sortModifiers: createSortModifiers(config),
	postfixLookupClassGroupIds: createPostfixLookupClassGroupIds(config),
	...createClassGroupUtils(config)
});
var createPostfixLookupClassGroupIds = (config) => {
	const lookup = Object.create(null);
	const classGroupIds = config.postfixLookupClassGroups;
	if (classGroupIds) for (let i = 0; i < classGroupIds.length; i++) lookup[classGroupIds[i]] = true;
	return lookup;
};
var SPLIT_CLASSES_REGEX = /\s+/;
var mergeClassList = (classList, configUtils) => {
	const { parseClassName, getClassGroupId, getConflictingClassGroupIds, sortModifiers, postfixLookupClassGroupIds } = configUtils;
	const classGroupsInConflict = [];
	const classNames = classList.trim().split(SPLIT_CLASSES_REGEX);
	let result = "";
	for (let index$1 = classNames.length - 1; index$1 >= 0; index$1 -= 1) {
		const originalClassName = classNames[index$1];
		const { isExternal, modifiers, hasImportantModifier, baseClassName, maybePostfixModifierPosition } = parseClassName(originalClassName);
		if (isExternal) {
			result = originalClassName + (result.length > 0 ? " " + result : result);
			continue;
		}
		let hasPostfixModifier = !!maybePostfixModifierPosition;
		let classGroupId;
		if (hasPostfixModifier) {
			classGroupId = getClassGroupId(baseClassName.substring(0, maybePostfixModifierPosition));
			const classGroupIdWithPostfix = classGroupId && postfixLookupClassGroupIds[classGroupId] ? getClassGroupId(baseClassName) : void 0;
			if (classGroupIdWithPostfix && classGroupIdWithPostfix !== classGroupId) {
				classGroupId = classGroupIdWithPostfix;
				hasPostfixModifier = false;
			}
		} else classGroupId = getClassGroupId(baseClassName);
		if (!classGroupId) {
			if (!hasPostfixModifier) {
				result = originalClassName + (result.length > 0 ? " " + result : result);
				continue;
			}
			classGroupId = getClassGroupId(baseClassName);
			if (!classGroupId) {
				result = originalClassName + (result.length > 0 ? " " + result : result);
				continue;
			}
			hasPostfixModifier = false;
		}
		const variantModifier = modifiers.length === 0 ? "" : modifiers.length === 1 ? modifiers[0] : sortModifiers(modifiers).join(":");
		const modifierId = hasImportantModifier ? variantModifier + IMPORTANT_MODIFIER : variantModifier;
		const classId = modifierId + classGroupId;
		if (classGroupsInConflict.indexOf(classId) > -1) continue;
		classGroupsInConflict.push(classId);
		const conflictGroups = getConflictingClassGroupIds(classGroupId, hasPostfixModifier);
		for (let i = 0; i < conflictGroups.length; ++i) {
			const group = conflictGroups[i];
			classGroupsInConflict.push(modifierId + group);
		}
		result = originalClassName + (result.length > 0 ? " " + result : result);
	}
	return result;
};
var twJoin = (...classLists) => {
	let index$1 = 0;
	let argument;
	let resolvedValue;
	let string = "";
	while (index$1 < classLists.length) if (argument = classLists[index$1++]) {
		if (resolvedValue = toValue(argument)) {
			string && (string += " ");
			string += resolvedValue;
		}
	}
	return string;
};
var toValue = (mix) => {
	if (typeof mix === "string") return mix;
	let resolvedValue;
	let string = "";
	for (let k$2 = 0; k$2 < mix.length; k$2++) if (mix[k$2]) {
		if (resolvedValue = toValue(mix[k$2])) {
			string && (string += " ");
			string += resolvedValue;
		}
	}
	return string;
};
var createTailwindMerge = (createConfigFirst, ...createConfigRest) => {
	let configUtils;
	let cacheGet;
	let cacheSet;
	let functionToCall;
	const initTailwindMerge = (classList) => {
		configUtils = createConfigUtils(createConfigRest.reduce((previousConfig, createConfigCurrent) => createConfigCurrent(previousConfig), createConfigFirst()));
		cacheGet = configUtils.cache.get;
		cacheSet = configUtils.cache.set;
		functionToCall = tailwindMerge;
		return tailwindMerge(classList);
	};
	const tailwindMerge = (classList) => {
		const cachedResult = cacheGet(classList);
		if (cachedResult) return cachedResult;
		const result = mergeClassList(classList, configUtils);
		cacheSet(classList, result);
		return result;
	};
	functionToCall = initTailwindMerge;
	return (...args) => functionToCall(twJoin(...args));
};
var fallbackThemeArr = [];
var fromTheme = (key) => {
	const themeGetter = (theme) => theme[key] || fallbackThemeArr;
	themeGetter.isThemeGetter = true;
	return themeGetter;
};
var arbitraryValueRegex = /^\[(?:(\w[\w-]*):)?(.+)\]$/i;
var arbitraryVariableRegex = /^\((?:(\w[\w-]*):)?(.+)\)$/i;
var fractionRegex = /^\d+(?:\.\d+)?\/\d+(?:\.\d+)?$/;
var tshirtUnitRegex = /^(\d+(\.\d+)?)?(xs|sm|md|lg|xl)$/;
var lengthUnitRegex = /\d+(%|px|r?em|[sdl]?v([hwib]|min|max)|pt|pc|in|cm|mm|cap|ch|ex|r?lh|cq(w|h|i|b|min|max))|\b(calc|min|max|clamp)\(.+\)|^0$/;
var colorFunctionRegex = /^(rgba?|hsla?|hwb|(ok)?(lab|lch)|color-mix)\(.+\)$/;
var shadowRegex = /^(inset_)?-?((\d+)?\.?(\d+)[a-z]+|0)_-?((\d+)?\.?(\d+)[a-z]+|0)/;
var imageRegex = /^(url|image|image-set|cross-fade|element|(repeating-)?(linear|radial|conic)-gradient)\(.+\)$/;
var isFraction = (value) => fractionRegex.test(value);
var isNumber = (value) => !!value && !Number.isNaN(Number(value));
var isInteger = (value) => !!value && Number.isInteger(Number(value));
var isPercent = (value) => value.endsWith("%") && isNumber(value.slice(0, -1));
var isTshirtSize = (value) => tshirtUnitRegex.test(value);
var isAny = () => true;
var isLengthOnly = (value) => lengthUnitRegex.test(value) && !colorFunctionRegex.test(value);
var isNever = () => false;
var isShadow = (value) => shadowRegex.test(value);
var isImage = (value) => imageRegex.test(value);
var isAnyNonArbitrary = (value) => !isArbitraryValue(value) && !isArbitraryVariable(value);
var isNamedContainerQuery = (value) => value.startsWith("@container") && (value[10] === "/" && value[11] !== void 0 || value[11] === "s" && value[16] !== void 0 && value.startsWith("-size/", 10) || value[11] === "n" && value[18] !== void 0 && value.startsWith("-normal/", 10));
var isArbitrarySize = (value) => getIsArbitraryValue(value, isLabelSize, isNever);
var isArbitraryValue = (value) => arbitraryValueRegex.test(value);
var isArbitraryLength = (value) => getIsArbitraryValue(value, isLabelLength, isLengthOnly);
var isArbitraryNumber = (value) => getIsArbitraryValue(value, isLabelNumber, isNumber);
var isArbitraryWeight = (value) => getIsArbitraryValue(value, isLabelWeight, isAny);
var isArbitraryFamilyName = (value) => getIsArbitraryValue(value, isLabelFamilyName, isNever);
var isArbitraryPosition = (value) => getIsArbitraryValue(value, isLabelPosition, isNever);
var isArbitraryImage = (value) => getIsArbitraryValue(value, isLabelImage, isImage);
var isArbitraryShadow = (value) => getIsArbitraryValue(value, isLabelShadow, isShadow);
var isArbitraryVariable = (value) => arbitraryVariableRegex.test(value);
var isArbitraryVariableLength = (value) => getIsArbitraryVariable(value, isLabelLength);
var isArbitraryVariableFamilyName = (value) => getIsArbitraryVariable(value, isLabelFamilyName);
var isArbitraryVariablePosition = (value) => getIsArbitraryVariable(value, isLabelPosition);
var isArbitraryVariableSize = (value) => getIsArbitraryVariable(value, isLabelSize);
var isArbitraryVariableImage = (value) => getIsArbitraryVariable(value, isLabelImage);
var isArbitraryVariableShadow = (value) => getIsArbitraryVariable(value, isLabelShadow, true);
var isArbitraryVariableWeight = (value) => getIsArbitraryVariable(value, isLabelWeight, true);
var getIsArbitraryValue = (value, testLabel, testValue) => {
	const result = arbitraryValueRegex.exec(value);
	if (result) {
		if (result[1]) return testLabel(result[1]);
		return testValue(result[2]);
	}
	return false;
};
var getIsArbitraryVariable = (value, testLabel, shouldMatchNoLabel = false) => {
	const result = arbitraryVariableRegex.exec(value);
	if (result) {
		if (result[1]) return testLabel(result[1]);
		return shouldMatchNoLabel;
	}
	return false;
};
var isLabelPosition = (label) => label === "position" || label === "percentage";
var isLabelImage = (label) => label === "image" || label === "url";
var isLabelSize = (label) => label === "length" || label === "size" || label === "bg-size";
var isLabelLength = (label) => label === "length";
var isLabelNumber = (label) => label === "number";
var isLabelFamilyName = (label) => label === "family-name";
var isLabelWeight = (label) => label === "number" || label === "weight";
var isLabelShadow = (label) => label === "shadow";
var getDefaultConfig = () => {
	const themeColor = fromTheme("color");
	const themeFont = fromTheme("font");
	const themeText = fromTheme("text");
	const themeFontWeight = fromTheme("font-weight");
	const themeTracking = fromTheme("tracking");
	const themeLeading = fromTheme("leading");
	const themeBreakpoint = fromTheme("breakpoint");
	const themeContainer = fromTheme("container");
	const themeSpacing = fromTheme("spacing");
	const themeRadius = fromTheme("radius");
	const themeShadow = fromTheme("shadow");
	const themeInsetShadow = fromTheme("inset-shadow");
	const themeTextShadow = fromTheme("text-shadow");
	const themeDropShadow = fromTheme("drop-shadow");
	const themeBlur = fromTheme("blur");
	const themePerspective = fromTheme("perspective");
	const themeAspect = fromTheme("aspect");
	const themeEase = fromTheme("ease");
	const themeAnimate = fromTheme("animate");
	const scaleBreak = () => [
		"auto",
		"avoid",
		"all",
		"avoid-page",
		"page",
		"left",
		"right",
		"column"
	];
	const scalePosition = () => [
		"center",
		"top",
		"bottom",
		"left",
		"right",
		"top-left",
		"left-top",
		"top-right",
		"right-top",
		"bottom-right",
		"right-bottom",
		"bottom-left",
		"left-bottom"
	];
	const scalePositionWithArbitrary = () => [
		...scalePosition(),
		isArbitraryVariable,
		isArbitraryValue
	];
	const scaleOverflow = () => [
		"auto",
		"hidden",
		"clip",
		"visible",
		"scroll"
	];
	const scaleOverscroll = () => [
		"auto",
		"contain",
		"none"
	];
	const scaleUnambiguousSpacing = () => [
		isArbitraryVariable,
		isArbitraryValue,
		themeSpacing
	];
	const scaleInset = () => [
		isFraction,
		"full",
		"auto",
		...scaleUnambiguousSpacing()
	];
	const scaleGridTemplateColsRows = () => [
		isInteger,
		"none",
		"subgrid",
		isArbitraryVariable,
		isArbitraryValue
	];
	const scaleGridColRowStartAndEnd = () => [
		"auto",
		{ span: [
			"full",
			isInteger,
			isArbitraryVariable,
			isArbitraryValue
		] },
		isInteger,
		isArbitraryVariable,
		isArbitraryValue
	];
	const scaleGridColRowStartOrEnd = () => [
		isInteger,
		"auto",
		isArbitraryVariable,
		isArbitraryValue
	];
	const scaleGridAutoColsRows = () => [
		"auto",
		"min",
		"max",
		"fr",
		isArbitraryVariable,
		isArbitraryValue
	];
	const scaleAlignPrimaryAxis = () => [
		"start",
		"end",
		"center",
		"between",
		"around",
		"evenly",
		"stretch",
		"baseline",
		"center-safe",
		"end-safe"
	];
	const scaleAlignSecondaryAxis = () => [
		"start",
		"end",
		"center",
		"stretch",
		"center-safe",
		"end-safe"
	];
	const scaleMargin = () => ["auto", ...scaleUnambiguousSpacing()];
	const scaleSizing = () => [
		isFraction,
		"auto",
		"full",
		"dvw",
		"dvh",
		"lvw",
		"lvh",
		"svw",
		"svh",
		"min",
		"max",
		"fit",
		...scaleUnambiguousSpacing()
	];
	const scaleSizingInline = () => [
		isFraction,
		"screen",
		"full",
		"dvw",
		"lvw",
		"svw",
		"min",
		"max",
		"fit",
		...scaleUnambiguousSpacing()
	];
	const scaleSizingBlock = () => [
		isFraction,
		"screen",
		"full",
		"lh",
		"dvh",
		"lvh",
		"svh",
		"min",
		"max",
		"fit",
		...scaleUnambiguousSpacing()
	];
	const scaleColor = () => [
		themeColor,
		isArbitraryVariable,
		isArbitraryValue
	];
	const scaleBgPosition = () => [
		...scalePosition(),
		isArbitraryVariablePosition,
		isArbitraryPosition,
		{ position: [isArbitraryVariable, isArbitraryValue] }
	];
	const scaleBgRepeat = () => ["no-repeat", { repeat: [
		"",
		"x",
		"y",
		"space",
		"round"
	] }];
	const scaleBgSize = () => [
		"auto",
		"cover",
		"contain",
		isArbitraryVariableSize,
		isArbitrarySize,
		{ size: [isArbitraryVariable, isArbitraryValue] }
	];
	const scaleGradientStopPosition = () => [
		isPercent,
		isArbitraryVariableLength,
		isArbitraryLength
	];
	const scaleRadius = () => [
		"",
		"none",
		"full",
		themeRadius,
		isArbitraryVariable,
		isArbitraryValue
	];
	const scaleBorderWidth = () => [
		"",
		isNumber,
		isArbitraryVariableLength,
		isArbitraryLength
	];
	const scaleLineStyle = () => [
		"solid",
		"dashed",
		"dotted",
		"double"
	];
	const scaleBlendMode = () => [
		"normal",
		"multiply",
		"screen",
		"overlay",
		"darken",
		"lighten",
		"color-dodge",
		"color-burn",
		"hard-light",
		"soft-light",
		"difference",
		"exclusion",
		"hue",
		"saturation",
		"color",
		"luminosity"
	];
	const scaleMaskImagePosition = () => [
		isNumber,
		isPercent,
		isArbitraryVariablePosition,
		isArbitraryPosition
	];
	const scaleBlur = () => [
		"",
		"none",
		themeBlur,
		isArbitraryVariable,
		isArbitraryValue
	];
	const scaleRotate = () => [
		"none",
		isNumber,
		isArbitraryVariable,
		isArbitraryValue
	];
	const scaleScale = () => [
		"none",
		isNumber,
		isArbitraryVariable,
		isArbitraryValue
	];
	const scaleSkew = () => [
		isNumber,
		isArbitraryVariable,
		isArbitraryValue
	];
	const scaleTranslate = () => [
		isFraction,
		"full",
		...scaleUnambiguousSpacing()
	];
	return {
		cacheSize: 500,
		theme: {
			animate: [
				"spin",
				"ping",
				"pulse",
				"bounce"
			],
			aspect: ["video"],
			blur: [isTshirtSize],
			breakpoint: [isTshirtSize],
			color: [isAny],
			container: [isTshirtSize],
			"drop-shadow": [isTshirtSize],
			ease: [
				"in",
				"out",
				"in-out"
			],
			font: [isAnyNonArbitrary],
			"font-weight": [
				"thin",
				"extralight",
				"light",
				"normal",
				"medium",
				"semibold",
				"bold",
				"extrabold",
				"black"
			],
			"inset-shadow": [isTshirtSize],
			leading: [
				"none",
				"tight",
				"snug",
				"normal",
				"relaxed",
				"loose"
			],
			perspective: [
				"dramatic",
				"near",
				"normal",
				"midrange",
				"distant",
				"none"
			],
			radius: [isTshirtSize],
			shadow: [isTshirtSize],
			spacing: ["px", isNumber],
			text: [isTshirtSize],
			"text-shadow": [isTshirtSize],
			tracking: [
				"tighter",
				"tight",
				"normal",
				"wide",
				"wider",
				"widest"
			]
		},
		classGroups: {
			aspect: [{ aspect: [
				"auto",
				"square",
				isFraction,
				isArbitraryValue,
				isArbitraryVariable,
				themeAspect
			] }],
			container: ["container"],
			"container-type": [{ "@container": [
				"",
				"normal",
				"size",
				isArbitraryVariable,
				isArbitraryValue
			] }],
			"container-named": [isNamedContainerQuery],
			columns: [{ columns: [
				isNumber,
				isArbitraryValue,
				isArbitraryVariable,
				themeContainer
			] }],
			"break-after": [{ "break-after": scaleBreak() }],
			"break-before": [{ "break-before": scaleBreak() }],
			"break-inside": [{ "break-inside": [
				"auto",
				"avoid",
				"avoid-page",
				"avoid-column"
			] }],
			"box-decoration": [{ "box-decoration": ["slice", "clone"] }],
			box: [{ box: ["border", "content"] }],
			display: [
				"block",
				"inline-block",
				"inline",
				"flex",
				"inline-flex",
				"table",
				"inline-table",
				"table-caption",
				"table-cell",
				"table-column",
				"table-column-group",
				"table-footer-group",
				"table-header-group",
				"table-row-group",
				"table-row",
				"flow-root",
				"grid",
				"inline-grid",
				"contents",
				"list-item",
				"hidden"
			],
			sr: ["sr-only", "not-sr-only"],
			float: [{ float: [
				"right",
				"left",
				"none",
				"start",
				"end"
			] }],
			clear: [{ clear: [
				"left",
				"right",
				"both",
				"none",
				"start",
				"end"
			] }],
			isolation: ["isolate", "isolation-auto"],
			"object-fit": [{ object: [
				"contain",
				"cover",
				"fill",
				"none",
				"scale-down"
			] }],
			"object-position": [{ object: scalePositionWithArbitrary() }],
			overflow: [{ overflow: scaleOverflow() }],
			"overflow-x": [{ "overflow-x": scaleOverflow() }],
			"overflow-y": [{ "overflow-y": scaleOverflow() }],
			overscroll: [{ overscroll: scaleOverscroll() }],
			"overscroll-x": [{ "overscroll-x": scaleOverscroll() }],
			"overscroll-y": [{ "overscroll-y": scaleOverscroll() }],
			position: [
				"static",
				"fixed",
				"absolute",
				"relative",
				"sticky"
			],
			inset: [{ inset: scaleInset() }],
			"inset-x": [{ "inset-x": scaleInset() }],
			"inset-y": [{ "inset-y": scaleInset() }],
			start: [{
				"inset-s": scaleInset(),
				start: scaleInset()
			}],
			end: [{
				"inset-e": scaleInset(),
				end: scaleInset()
			}],
			"inset-bs": [{ "inset-bs": scaleInset() }],
			"inset-be": [{ "inset-be": scaleInset() }],
			top: [{ top: scaleInset() }],
			right: [{ right: scaleInset() }],
			bottom: [{ bottom: scaleInset() }],
			left: [{ left: scaleInset() }],
			visibility: [
				"visible",
				"invisible",
				"collapse"
			],
			z: [{ z: [
				isInteger,
				"auto",
				isArbitraryVariable,
				isArbitraryValue
			] }],
			basis: [{ basis: [
				isFraction,
				"full",
				"auto",
				themeContainer,
				...scaleUnambiguousSpacing()
			] }],
			"flex-direction": [{ flex: [
				"row",
				"row-reverse",
				"col",
				"col-reverse"
			] }],
			"flex-wrap": [{ flex: [
				"nowrap",
				"wrap",
				"wrap-reverse"
			] }],
			flex: [{ flex: [
				isNumber,
				isFraction,
				"auto",
				"initial",
				"none",
				isArbitraryValue
			] }],
			grow: [{ grow: [
				"",
				isNumber,
				isArbitraryVariable,
				isArbitraryValue
			] }],
			shrink: [{ shrink: [
				"",
				isNumber,
				isArbitraryVariable,
				isArbitraryValue
			] }],
			order: [{ order: [
				isInteger,
				"first",
				"last",
				"none",
				isArbitraryVariable,
				isArbitraryValue
			] }],
			"grid-cols": [{ "grid-cols": scaleGridTemplateColsRows() }],
			"col-start-end": [{ col: scaleGridColRowStartAndEnd() }],
			"col-start": [{ "col-start": scaleGridColRowStartOrEnd() }],
			"col-end": [{ "col-end": scaleGridColRowStartOrEnd() }],
			"grid-rows": [{ "grid-rows": scaleGridTemplateColsRows() }],
			"row-start-end": [{ row: scaleGridColRowStartAndEnd() }],
			"row-start": [{ "row-start": scaleGridColRowStartOrEnd() }],
			"row-end": [{ "row-end": scaleGridColRowStartOrEnd() }],
			"grid-flow": [{ "grid-flow": [
				"row",
				"col",
				"dense",
				"row-dense",
				"col-dense"
			] }],
			"auto-cols": [{ "auto-cols": scaleGridAutoColsRows() }],
			"auto-rows": [{ "auto-rows": scaleGridAutoColsRows() }],
			gap: [{ gap: scaleUnambiguousSpacing() }],
			"gap-x": [{ "gap-x": scaleUnambiguousSpacing() }],
			"gap-y": [{ "gap-y": scaleUnambiguousSpacing() }],
			"justify-content": [{ justify: [...scaleAlignPrimaryAxis(), "normal"] }],
			"justify-items": [{ "justify-items": [...scaleAlignSecondaryAxis(), "normal"] }],
			"justify-self": [{ "justify-self": ["auto", ...scaleAlignSecondaryAxis()] }],
			"align-content": [{ content: ["normal", ...scaleAlignPrimaryAxis()] }],
			"align-items": [{ items: [...scaleAlignSecondaryAxis(), { baseline: ["", "last"] }] }],
			"align-self": [{ self: [
				"auto",
				...scaleAlignSecondaryAxis(),
				{ baseline: ["", "last"] }
			] }],
			"place-content": [{ "place-content": scaleAlignPrimaryAxis() }],
			"place-items": [{ "place-items": [...scaleAlignSecondaryAxis(), "baseline"] }],
			"place-self": [{ "place-self": ["auto", ...scaleAlignSecondaryAxis()] }],
			p: [{ p: scaleUnambiguousSpacing() }],
			px: [{ px: scaleUnambiguousSpacing() }],
			py: [{ py: scaleUnambiguousSpacing() }],
			ps: [{ ps: scaleUnambiguousSpacing() }],
			pe: [{ pe: scaleUnambiguousSpacing() }],
			pbs: [{ pbs: scaleUnambiguousSpacing() }],
			pbe: [{ pbe: scaleUnambiguousSpacing() }],
			pt: [{ pt: scaleUnambiguousSpacing() }],
			pr: [{ pr: scaleUnambiguousSpacing() }],
			pb: [{ pb: scaleUnambiguousSpacing() }],
			pl: [{ pl: scaleUnambiguousSpacing() }],
			m: [{ m: scaleMargin() }],
			mx: [{ mx: scaleMargin() }],
			my: [{ my: scaleMargin() }],
			ms: [{ ms: scaleMargin() }],
			me: [{ me: scaleMargin() }],
			mbs: [{ mbs: scaleMargin() }],
			mbe: [{ mbe: scaleMargin() }],
			mt: [{ mt: scaleMargin() }],
			mr: [{ mr: scaleMargin() }],
			mb: [{ mb: scaleMargin() }],
			ml: [{ ml: scaleMargin() }],
			"space-x": [{ "space-x": scaleUnambiguousSpacing() }],
			"space-x-reverse": ["space-x-reverse"],
			"space-y": [{ "space-y": scaleUnambiguousSpacing() }],
			"space-y-reverse": ["space-y-reverse"],
			size: [{ size: scaleSizing() }],
			"inline-size": [{ inline: ["auto", ...scaleSizingInline()] }],
			"min-inline-size": [{ "min-inline": ["auto", ...scaleSizingInline()] }],
			"max-inline-size": [{ "max-inline": ["none", ...scaleSizingInline()] }],
			"block-size": [{ block: ["auto", ...scaleSizingBlock()] }],
			"min-block-size": [{ "min-block": ["auto", ...scaleSizingBlock()] }],
			"max-block-size": [{ "max-block": ["none", ...scaleSizingBlock()] }],
			w: [{ w: [
				themeContainer,
				"screen",
				...scaleSizing()
			] }],
			"min-w": [{ "min-w": [
				themeContainer,
				"screen",
				"none",
				...scaleSizing()
			] }],
			"max-w": [{ "max-w": [
				themeContainer,
				"screen",
				"none",
				"prose",
				{ screen: [themeBreakpoint] },
				...scaleSizing()
			] }],
			h: [{ h: [
				"screen",
				"lh",
				...scaleSizing()
			] }],
			"min-h": [{ "min-h": [
				"screen",
				"lh",
				"none",
				...scaleSizing()
			] }],
			"max-h": [{ "max-h": [
				"screen",
				"lh",
				...scaleSizing()
			] }],
			"font-size": [{ text: [
				"base",
				themeText,
				isArbitraryVariableLength,
				isArbitraryLength
			] }],
			"font-smoothing": ["antialiased", "subpixel-antialiased"],
			"font-style": ["italic", "not-italic"],
			"font-weight": [{ font: [
				themeFontWeight,
				isArbitraryVariableWeight,
				isArbitraryWeight
			] }],
			"font-stretch": [{ "font-stretch": [
				"ultra-condensed",
				"extra-condensed",
				"condensed",
				"semi-condensed",
				"normal",
				"semi-expanded",
				"expanded",
				"extra-expanded",
				"ultra-expanded",
				isPercent,
				isArbitraryValue
			] }],
			"font-family": [{ font: [
				isArbitraryVariableFamilyName,
				isArbitraryFamilyName,
				themeFont
			] }],
			"font-features": [{ "font-features": [isArbitraryValue] }],
			"fvn-normal": ["normal-nums"],
			"fvn-ordinal": ["ordinal"],
			"fvn-slashed-zero": ["slashed-zero"],
			"fvn-figure": ["lining-nums", "oldstyle-nums"],
			"fvn-spacing": ["proportional-nums", "tabular-nums"],
			"fvn-fraction": ["diagonal-fractions", "stacked-fractions"],
			tracking: [{ tracking: [
				themeTracking,
				isArbitraryVariable,
				isArbitraryValue
			] }],
			"line-clamp": [{ "line-clamp": [
				isNumber,
				"none",
				isArbitraryVariable,
				isArbitraryNumber
			] }],
			leading: [{ leading: [themeLeading, ...scaleUnambiguousSpacing()] }],
			"list-image": [{ "list-image": [
				"none",
				isArbitraryVariable,
				isArbitraryValue
			] }],
			"list-style-position": [{ list: ["inside", "outside"] }],
			"list-style-type": [{ list: [
				"disc",
				"decimal",
				"none",
				isArbitraryVariable,
				isArbitraryValue
			] }],
			"text-alignment": [{ text: [
				"left",
				"center",
				"right",
				"justify",
				"start",
				"end"
			] }],
			"placeholder-color": [{ placeholder: scaleColor() }],
			"text-color": [{ text: scaleColor() }],
			"text-decoration": [
				"underline",
				"overline",
				"line-through",
				"no-underline"
			],
			"text-decoration-style": [{ decoration: [...scaleLineStyle(), "wavy"] }],
			"text-decoration-thickness": [{ decoration: [
				isNumber,
				"from-font",
				"auto",
				isArbitraryVariable,
				isArbitraryLength
			] }],
			"text-decoration-color": [{ decoration: scaleColor() }],
			"underline-offset": [{ "underline-offset": [
				isNumber,
				"auto",
				isArbitraryVariable,
				isArbitraryValue
			] }],
			"text-transform": [
				"uppercase",
				"lowercase",
				"capitalize",
				"normal-case"
			],
			"text-overflow": [
				"truncate",
				"text-ellipsis",
				"text-clip"
			],
			"text-wrap": [{ text: [
				"wrap",
				"nowrap",
				"balance",
				"pretty"
			] }],
			indent: [{ indent: scaleUnambiguousSpacing() }],
			"tab-size": [{ tab: [
				isInteger,
				isArbitraryVariable,
				isArbitraryValue
			] }],
			"vertical-align": [{ align: [
				"baseline",
				"top",
				"middle",
				"bottom",
				"text-top",
				"text-bottom",
				"sub",
				"super",
				isArbitraryVariable,
				isArbitraryValue
			] }],
			whitespace: [{ whitespace: [
				"normal",
				"nowrap",
				"pre",
				"pre-line",
				"pre-wrap",
				"break-spaces"
			] }],
			break: [{ break: [
				"normal",
				"words",
				"all",
				"keep"
			] }],
			wrap: [{ wrap: [
				"break-word",
				"anywhere",
				"normal"
			] }],
			hyphens: [{ hyphens: [
				"none",
				"manual",
				"auto"
			] }],
			content: [{ content: [
				"none",
				isArbitraryVariable,
				isArbitraryValue
			] }],
			"bg-attachment": [{ bg: [
				"fixed",
				"local",
				"scroll"
			] }],
			"bg-clip": [{ "bg-clip": [
				"border",
				"padding",
				"content",
				"text"
			] }],
			"bg-origin": [{ "bg-origin": [
				"border",
				"padding",
				"content"
			] }],
			"bg-position": [{ bg: scaleBgPosition() }],
			"bg-repeat": [{ bg: scaleBgRepeat() }],
			"bg-size": [{ bg: scaleBgSize() }],
			"bg-image": [{ bg: [
				"none",
				{
					linear: [
						{ to: [
							"t",
							"tr",
							"r",
							"br",
							"b",
							"bl",
							"l",
							"tl"
						] },
						isInteger,
						isArbitraryVariable,
						isArbitraryValue
					],
					radial: [
						"",
						isArbitraryVariable,
						isArbitraryValue
					],
					conic: [
						isInteger,
						isArbitraryVariable,
						isArbitraryValue
					]
				},
				isArbitraryVariableImage,
				isArbitraryImage
			] }],
			"bg-color": [{ bg: scaleColor() }],
			"gradient-from-pos": [{ from: scaleGradientStopPosition() }],
			"gradient-via-pos": [{ via: scaleGradientStopPosition() }],
			"gradient-to-pos": [{ to: scaleGradientStopPosition() }],
			"gradient-from": [{ from: scaleColor() }],
			"gradient-via": [{ via: scaleColor() }],
			"gradient-to": [{ to: scaleColor() }],
			rounded: [{ rounded: scaleRadius() }],
			"rounded-s": [{ "rounded-s": scaleRadius() }],
			"rounded-e": [{ "rounded-e": scaleRadius() }],
			"rounded-t": [{ "rounded-t": scaleRadius() }],
			"rounded-r": [{ "rounded-r": scaleRadius() }],
			"rounded-b": [{ "rounded-b": scaleRadius() }],
			"rounded-l": [{ "rounded-l": scaleRadius() }],
			"rounded-ss": [{ "rounded-ss": scaleRadius() }],
			"rounded-se": [{ "rounded-se": scaleRadius() }],
			"rounded-ee": [{ "rounded-ee": scaleRadius() }],
			"rounded-es": [{ "rounded-es": scaleRadius() }],
			"rounded-tl": [{ "rounded-tl": scaleRadius() }],
			"rounded-tr": [{ "rounded-tr": scaleRadius() }],
			"rounded-br": [{ "rounded-br": scaleRadius() }],
			"rounded-bl": [{ "rounded-bl": scaleRadius() }],
			"border-w": [{ border: scaleBorderWidth() }],
			"border-w-x": [{ "border-x": scaleBorderWidth() }],
			"border-w-y": [{ "border-y": scaleBorderWidth() }],
			"border-w-s": [{ "border-s": scaleBorderWidth() }],
			"border-w-e": [{ "border-e": scaleBorderWidth() }],
			"border-w-bs": [{ "border-bs": scaleBorderWidth() }],
			"border-w-be": [{ "border-be": scaleBorderWidth() }],
			"border-w-t": [{ "border-t": scaleBorderWidth() }],
			"border-w-r": [{ "border-r": scaleBorderWidth() }],
			"border-w-b": [{ "border-b": scaleBorderWidth() }],
			"border-w-l": [{ "border-l": scaleBorderWidth() }],
			"divide-x": [{ "divide-x": scaleBorderWidth() }],
			"divide-x-reverse": ["divide-x-reverse"],
			"divide-y": [{ "divide-y": scaleBorderWidth() }],
			"divide-y-reverse": ["divide-y-reverse"],
			"border-style": [{ border: [
				...scaleLineStyle(),
				"hidden",
				"none"
			] }],
			"divide-style": [{ divide: [
				...scaleLineStyle(),
				"hidden",
				"none"
			] }],
			"border-color": [{ border: scaleColor() }],
			"border-color-x": [{ "border-x": scaleColor() }],
			"border-color-y": [{ "border-y": scaleColor() }],
			"border-color-s": [{ "border-s": scaleColor() }],
			"border-color-e": [{ "border-e": scaleColor() }],
			"border-color-bs": [{ "border-bs": scaleColor() }],
			"border-color-be": [{ "border-be": scaleColor() }],
			"border-color-t": [{ "border-t": scaleColor() }],
			"border-color-r": [{ "border-r": scaleColor() }],
			"border-color-b": [{ "border-b": scaleColor() }],
			"border-color-l": [{ "border-l": scaleColor() }],
			"divide-color": [{ divide: scaleColor() }],
			"outline-style": [{ outline: [
				...scaleLineStyle(),
				"none",
				"hidden"
			] }],
			"outline-offset": [{ "outline-offset": [
				isNumber,
				isArbitraryVariable,
				isArbitraryValue
			] }],
			"outline-w": [{ outline: [
				"",
				isNumber,
				isArbitraryVariableLength,
				isArbitraryLength
			] }],
			"outline-color": [{ outline: scaleColor() }],
			shadow: [{ shadow: [
				"",
				"none",
				themeShadow,
				isArbitraryVariableShadow,
				isArbitraryShadow
			] }],
			"shadow-color": [{ shadow: scaleColor() }],
			"inset-shadow": [{ "inset-shadow": [
				"none",
				themeInsetShadow,
				isArbitraryVariableShadow,
				isArbitraryShadow
			] }],
			"inset-shadow-color": [{ "inset-shadow": scaleColor() }],
			"ring-w": [{ ring: scaleBorderWidth() }],
			"ring-w-inset": ["ring-inset"],
			"ring-color": [{ ring: scaleColor() }],
			"ring-offset-w": [{ "ring-offset": [isNumber, isArbitraryLength] }],
			"ring-offset-color": [{ "ring-offset": scaleColor() }],
			"inset-ring-w": [{ "inset-ring": scaleBorderWidth() }],
			"inset-ring-color": [{ "inset-ring": scaleColor() }],
			"text-shadow": [{ "text-shadow": [
				"none",
				themeTextShadow,
				isArbitraryVariableShadow,
				isArbitraryShadow
			] }],
			"text-shadow-color": [{ "text-shadow": scaleColor() }],
			opacity: [{ opacity: [
				isNumber,
				isArbitraryVariable,
				isArbitraryValue
			] }],
			"mix-blend": [{ "mix-blend": [
				...scaleBlendMode(),
				"plus-darker",
				"plus-lighter"
			] }],
			"bg-blend": [{ "bg-blend": scaleBlendMode() }],
			"mask-clip": [{ "mask-clip": [
				"border",
				"padding",
				"content",
				"fill",
				"stroke",
				"view"
			] }, "mask-no-clip"],
			"mask-composite": [{ mask: [
				"add",
				"subtract",
				"intersect",
				"exclude"
			] }],
			"mask-image-linear-pos": [{ "mask-linear": [isNumber] }],
			"mask-image-linear-from-pos": [{ "mask-linear-from": scaleMaskImagePosition() }],
			"mask-image-linear-to-pos": [{ "mask-linear-to": scaleMaskImagePosition() }],
			"mask-image-linear-from-color": [{ "mask-linear-from": scaleColor() }],
			"mask-image-linear-to-color": [{ "mask-linear-to": scaleColor() }],
			"mask-image-t-from-pos": [{ "mask-t-from": scaleMaskImagePosition() }],
			"mask-image-t-to-pos": [{ "mask-t-to": scaleMaskImagePosition() }],
			"mask-image-t-from-color": [{ "mask-t-from": scaleColor() }],
			"mask-image-t-to-color": [{ "mask-t-to": scaleColor() }],
			"mask-image-r-from-pos": [{ "mask-r-from": scaleMaskImagePosition() }],
			"mask-image-r-to-pos": [{ "mask-r-to": scaleMaskImagePosition() }],
			"mask-image-r-from-color": [{ "mask-r-from": scaleColor() }],
			"mask-image-r-to-color": [{ "mask-r-to": scaleColor() }],
			"mask-image-b-from-pos": [{ "mask-b-from": scaleMaskImagePosition() }],
			"mask-image-b-to-pos": [{ "mask-b-to": scaleMaskImagePosition() }],
			"mask-image-b-from-color": [{ "mask-b-from": scaleColor() }],
			"mask-image-b-to-color": [{ "mask-b-to": scaleColor() }],
			"mask-image-l-from-pos": [{ "mask-l-from": scaleMaskImagePosition() }],
			"mask-image-l-to-pos": [{ "mask-l-to": scaleMaskImagePosition() }],
			"mask-image-l-from-color": [{ "mask-l-from": scaleColor() }],
			"mask-image-l-to-color": [{ "mask-l-to": scaleColor() }],
			"mask-image-x-from-pos": [{ "mask-x-from": scaleMaskImagePosition() }],
			"mask-image-x-to-pos": [{ "mask-x-to": scaleMaskImagePosition() }],
			"mask-image-x-from-color": [{ "mask-x-from": scaleColor() }],
			"mask-image-x-to-color": [{ "mask-x-to": scaleColor() }],
			"mask-image-y-from-pos": [{ "mask-y-from": scaleMaskImagePosition() }],
			"mask-image-y-to-pos": [{ "mask-y-to": scaleMaskImagePosition() }],
			"mask-image-y-from-color": [{ "mask-y-from": scaleColor() }],
			"mask-image-y-to-color": [{ "mask-y-to": scaleColor() }],
			"mask-image-radial": [{ "mask-radial": [isArbitraryVariable, isArbitraryValue] }],
			"mask-image-radial-from-pos": [{ "mask-radial-from": scaleMaskImagePosition() }],
			"mask-image-radial-to-pos": [{ "mask-radial-to": scaleMaskImagePosition() }],
			"mask-image-radial-from-color": [{ "mask-radial-from": scaleColor() }],
			"mask-image-radial-to-color": [{ "mask-radial-to": scaleColor() }],
			"mask-image-radial-shape": [{ "mask-radial": ["circle", "ellipse"] }],
			"mask-image-radial-size": [{ "mask-radial": [{
				closest: ["side", "corner"],
				farthest: ["side", "corner"]
			}] }],
			"mask-image-radial-pos": [{ "mask-radial-at": scalePosition() }],
			"mask-image-conic-pos": [{ "mask-conic": [isNumber] }],
			"mask-image-conic-from-pos": [{ "mask-conic-from": scaleMaskImagePosition() }],
			"mask-image-conic-to-pos": [{ "mask-conic-to": scaleMaskImagePosition() }],
			"mask-image-conic-from-color": [{ "mask-conic-from": scaleColor() }],
			"mask-image-conic-to-color": [{ "mask-conic-to": scaleColor() }],
			"mask-mode": [{ mask: [
				"alpha",
				"luminance",
				"match"
			] }],
			"mask-origin": [{ "mask-origin": [
				"border",
				"padding",
				"content",
				"fill",
				"stroke",
				"view"
			] }],
			"mask-position": [{ mask: scaleBgPosition() }],
			"mask-repeat": [{ mask: scaleBgRepeat() }],
			"mask-size": [{ mask: scaleBgSize() }],
			"mask-type": [{ "mask-type": ["alpha", "luminance"] }],
			"mask-image": [{ mask: [
				"none",
				isArbitraryVariable,
				isArbitraryValue
			] }],
			filter: [{ filter: [
				"",
				"none",
				isArbitraryVariable,
				isArbitraryValue
			] }],
			blur: [{ blur: scaleBlur() }],
			brightness: [{ brightness: [
				isNumber,
				isArbitraryVariable,
				isArbitraryValue
			] }],
			contrast: [{ contrast: [
				isNumber,
				isArbitraryVariable,
				isArbitraryValue
			] }],
			"drop-shadow": [{ "drop-shadow": [
				"",
				"none",
				themeDropShadow,
				isArbitraryVariableShadow,
				isArbitraryShadow
			] }],
			"drop-shadow-color": [{ "drop-shadow": scaleColor() }],
			grayscale: [{ grayscale: [
				"",
				isNumber,
				isArbitraryVariable,
				isArbitraryValue
			] }],
			"hue-rotate": [{ "hue-rotate": [
				isNumber,
				isArbitraryVariable,
				isArbitraryValue
			] }],
			invert: [{ invert: [
				"",
				isNumber,
				isArbitraryVariable,
				isArbitraryValue
			] }],
			saturate: [{ saturate: [
				isNumber,
				isArbitraryVariable,
				isArbitraryValue
			] }],
			sepia: [{ sepia: [
				"",
				isNumber,
				isArbitraryVariable,
				isArbitraryValue
			] }],
			"backdrop-filter": [{ "backdrop-filter": [
				"",
				"none",
				isArbitraryVariable,
				isArbitraryValue
			] }],
			"backdrop-blur": [{ "backdrop-blur": scaleBlur() }],
			"backdrop-brightness": [{ "backdrop-brightness": [
				isNumber,
				isArbitraryVariable,
				isArbitraryValue
			] }],
			"backdrop-contrast": [{ "backdrop-contrast": [
				isNumber,
				isArbitraryVariable,
				isArbitraryValue
			] }],
			"backdrop-grayscale": [{ "backdrop-grayscale": [
				"",
				isNumber,
				isArbitraryVariable,
				isArbitraryValue
			] }],
			"backdrop-hue-rotate": [{ "backdrop-hue-rotate": [
				isNumber,
				isArbitraryVariable,
				isArbitraryValue
			] }],
			"backdrop-invert": [{ "backdrop-invert": [
				"",
				isNumber,
				isArbitraryVariable,
				isArbitraryValue
			] }],
			"backdrop-opacity": [{ "backdrop-opacity": [
				isNumber,
				isArbitraryVariable,
				isArbitraryValue
			] }],
			"backdrop-saturate": [{ "backdrop-saturate": [
				isNumber,
				isArbitraryVariable,
				isArbitraryValue
			] }],
			"backdrop-sepia": [{ "backdrop-sepia": [
				"",
				isNumber,
				isArbitraryVariable,
				isArbitraryValue
			] }],
			"border-collapse": [{ border: ["collapse", "separate"] }],
			"border-spacing": [{ "border-spacing": scaleUnambiguousSpacing() }],
			"border-spacing-x": [{ "border-spacing-x": scaleUnambiguousSpacing() }],
			"border-spacing-y": [{ "border-spacing-y": scaleUnambiguousSpacing() }],
			"table-layout": [{ table: ["auto", "fixed"] }],
			caption: [{ caption: ["top", "bottom"] }],
			transition: [{ transition: [
				"",
				"all",
				"colors",
				"opacity",
				"shadow",
				"transform",
				"none",
				isArbitraryVariable,
				isArbitraryValue
			] }],
			"transition-behavior": [{ transition: ["normal", "discrete"] }],
			duration: [{ duration: [
				isNumber,
				"initial",
				isArbitraryVariable,
				isArbitraryValue
			] }],
			ease: [{ ease: [
				"linear",
				"initial",
				themeEase,
				isArbitraryVariable,
				isArbitraryValue
			] }],
			delay: [{ delay: [
				isNumber,
				isArbitraryVariable,
				isArbitraryValue
			] }],
			animate: [{ animate: [
				"none",
				themeAnimate,
				isArbitraryVariable,
				isArbitraryValue
			] }],
			backface: [{ backface: ["hidden", "visible"] }],
			perspective: [{ perspective: [
				themePerspective,
				isArbitraryVariable,
				isArbitraryValue
			] }],
			"perspective-origin": [{ "perspective-origin": scalePositionWithArbitrary() }],
			rotate: [{ rotate: scaleRotate() }],
			"rotate-x": [{ "rotate-x": scaleRotate() }],
			"rotate-y": [{ "rotate-y": scaleRotate() }],
			"rotate-z": [{ "rotate-z": scaleRotate() }],
			scale: [{ scale: scaleScale() }],
			"scale-x": [{ "scale-x": scaleScale() }],
			"scale-y": [{ "scale-y": scaleScale() }],
			"scale-z": [{ "scale-z": scaleScale() }],
			"scale-3d": ["scale-3d"],
			skew: [{ skew: scaleSkew() }],
			"skew-x": [{ "skew-x": scaleSkew() }],
			"skew-y": [{ "skew-y": scaleSkew() }],
			transform: [{ transform: [
				isArbitraryVariable,
				isArbitraryValue,
				"",
				"none",
				"gpu",
				"cpu"
			] }],
			"transform-origin": [{ origin: scalePositionWithArbitrary() }],
			"transform-style": [{ transform: ["3d", "flat"] }],
			translate: [{ translate: scaleTranslate() }],
			"translate-x": [{ "translate-x": scaleTranslate() }],
			"translate-y": [{ "translate-y": scaleTranslate() }],
			"translate-z": [{ "translate-z": scaleTranslate() }],
			"translate-none": ["translate-none"],
			zoom: [{ zoom: [
				isInteger,
				isArbitraryVariable,
				isArbitraryValue
			] }],
			accent: [{ accent: scaleColor() }],
			appearance: [{ appearance: ["none", "auto"] }],
			"caret-color": [{ caret: scaleColor() }],
			"color-scheme": [{ scheme: [
				"normal",
				"dark",
				"light",
				"light-dark",
				"only-dark",
				"only-light"
			] }],
			cursor: [{ cursor: [
				"auto",
				"default",
				"pointer",
				"wait",
				"text",
				"move",
				"help",
				"not-allowed",
				"none",
				"context-menu",
				"progress",
				"cell",
				"crosshair",
				"vertical-text",
				"alias",
				"copy",
				"no-drop",
				"grab",
				"grabbing",
				"all-scroll",
				"col-resize",
				"row-resize",
				"n-resize",
				"e-resize",
				"s-resize",
				"w-resize",
				"ne-resize",
				"nw-resize",
				"se-resize",
				"sw-resize",
				"ew-resize",
				"ns-resize",
				"nesw-resize",
				"nwse-resize",
				"zoom-in",
				"zoom-out",
				isArbitraryVariable,
				isArbitraryValue
			] }],
			"field-sizing": [{ "field-sizing": ["fixed", "content"] }],
			"pointer-events": [{ "pointer-events": ["auto", "none"] }],
			resize: [{ resize: [
				"none",
				"",
				"y",
				"x"
			] }],
			"scroll-behavior": [{ scroll: ["auto", "smooth"] }],
			"scrollbar-thumb-color": [{ "scrollbar-thumb": scaleColor() }],
			"scrollbar-track-color": [{ "scrollbar-track": scaleColor() }],
			"scrollbar-gutter": [{ "scrollbar-gutter": [
				"auto",
				"stable",
				"both"
			] }],
			"scrollbar-w": [{ scrollbar: [
				"auto",
				"thin",
				"none"
			] }],
			"scroll-m": [{ "scroll-m": scaleUnambiguousSpacing() }],
			"scroll-mx": [{ "scroll-mx": scaleUnambiguousSpacing() }],
			"scroll-my": [{ "scroll-my": scaleUnambiguousSpacing() }],
			"scroll-ms": [{ "scroll-ms": scaleUnambiguousSpacing() }],
			"scroll-me": [{ "scroll-me": scaleUnambiguousSpacing() }],
			"scroll-mbs": [{ "scroll-mbs": scaleUnambiguousSpacing() }],
			"scroll-mbe": [{ "scroll-mbe": scaleUnambiguousSpacing() }],
			"scroll-mt": [{ "scroll-mt": scaleUnambiguousSpacing() }],
			"scroll-mr": [{ "scroll-mr": scaleUnambiguousSpacing() }],
			"scroll-mb": [{ "scroll-mb": scaleUnambiguousSpacing() }],
			"scroll-ml": [{ "scroll-ml": scaleUnambiguousSpacing() }],
			"scroll-p": [{ "scroll-p": scaleUnambiguousSpacing() }],
			"scroll-px": [{ "scroll-px": scaleUnambiguousSpacing() }],
			"scroll-py": [{ "scroll-py": scaleUnambiguousSpacing() }],
			"scroll-ps": [{ "scroll-ps": scaleUnambiguousSpacing() }],
			"scroll-pe": [{ "scroll-pe": scaleUnambiguousSpacing() }],
			"scroll-pbs": [{ "scroll-pbs": scaleUnambiguousSpacing() }],
			"scroll-pbe": [{ "scroll-pbe": scaleUnambiguousSpacing() }],
			"scroll-pt": [{ "scroll-pt": scaleUnambiguousSpacing() }],
			"scroll-pr": [{ "scroll-pr": scaleUnambiguousSpacing() }],
			"scroll-pb": [{ "scroll-pb": scaleUnambiguousSpacing() }],
			"scroll-pl": [{ "scroll-pl": scaleUnambiguousSpacing() }],
			"snap-align": [{ snap: [
				"start",
				"end",
				"center",
				"align-none"
			] }],
			"snap-stop": [{ snap: ["normal", "always"] }],
			"snap-type": [{ snap: [
				"none",
				"x",
				"y",
				"both"
			] }],
			"snap-strictness": [{ snap: ["mandatory", "proximity"] }],
			touch: [{ touch: [
				"auto",
				"none",
				"manipulation"
			] }],
			"touch-x": [{ "touch-pan": [
				"x",
				"left",
				"right"
			] }],
			"touch-y": [{ "touch-pan": [
				"y",
				"up",
				"down"
			] }],
			"touch-pz": ["touch-pinch-zoom"],
			select: [{ select: [
				"none",
				"text",
				"all",
				"auto"
			] }],
			"will-change": [{ "will-change": [
				"auto",
				"scroll",
				"contents",
				"transform",
				isArbitraryVariable,
				isArbitraryValue
			] }],
			fill: [{ fill: ["none", ...scaleColor()] }],
			"stroke-w": [{ stroke: [
				isNumber,
				isArbitraryVariableLength,
				isArbitraryLength,
				isArbitraryNumber
			] }],
			stroke: [{ stroke: ["none", ...scaleColor()] }],
			"forced-color-adjust": [{ "forced-color-adjust": ["auto", "none"] }]
		},
		conflictingClassGroups: {
			"container-named": ["container-type"],
			overflow: ["overflow-x", "overflow-y"],
			overscroll: ["overscroll-x", "overscroll-y"],
			inset: [
				"inset-x",
				"inset-y",
				"inset-bs",
				"inset-be",
				"start",
				"end",
				"top",
				"right",
				"bottom",
				"left"
			],
			"inset-x": ["right", "left"],
			"inset-y": ["top", "bottom"],
			flex: [
				"basis",
				"grow",
				"shrink"
			],
			gap: ["gap-x", "gap-y"],
			p: [
				"px",
				"py",
				"ps",
				"pe",
				"pbs",
				"pbe",
				"pt",
				"pr",
				"pb",
				"pl"
			],
			px: ["pr", "pl"],
			py: ["pt", "pb"],
			m: [
				"mx",
				"my",
				"ms",
				"me",
				"mbs",
				"mbe",
				"mt",
				"mr",
				"mb",
				"ml"
			],
			mx: ["mr", "ml"],
			my: ["mt", "mb"],
			size: ["w", "h"],
			"font-size": ["leading"],
			"fvn-normal": [
				"fvn-ordinal",
				"fvn-slashed-zero",
				"fvn-figure",
				"fvn-spacing",
				"fvn-fraction"
			],
			"fvn-ordinal": ["fvn-normal"],
			"fvn-slashed-zero": ["fvn-normal"],
			"fvn-figure": ["fvn-normal"],
			"fvn-spacing": ["fvn-normal"],
			"fvn-fraction": ["fvn-normal"],
			"line-clamp": ["display", "overflow"],
			rounded: [
				"rounded-s",
				"rounded-e",
				"rounded-t",
				"rounded-r",
				"rounded-b",
				"rounded-l",
				"rounded-ss",
				"rounded-se",
				"rounded-ee",
				"rounded-es",
				"rounded-tl",
				"rounded-tr",
				"rounded-br",
				"rounded-bl"
			],
			"rounded-s": ["rounded-ss", "rounded-es"],
			"rounded-e": ["rounded-se", "rounded-ee"],
			"rounded-t": ["rounded-tl", "rounded-tr"],
			"rounded-r": ["rounded-tr", "rounded-br"],
			"rounded-b": ["rounded-br", "rounded-bl"],
			"rounded-l": ["rounded-tl", "rounded-bl"],
			"border-spacing": ["border-spacing-x", "border-spacing-y"],
			"border-w": [
				"border-w-x",
				"border-w-y",
				"border-w-s",
				"border-w-e",
				"border-w-bs",
				"border-w-be",
				"border-w-t",
				"border-w-r",
				"border-w-b",
				"border-w-l"
			],
			"border-w-x": ["border-w-r", "border-w-l"],
			"border-w-y": ["border-w-t", "border-w-b"],
			"border-color": [
				"border-color-x",
				"border-color-y",
				"border-color-s",
				"border-color-e",
				"border-color-bs",
				"border-color-be",
				"border-color-t",
				"border-color-r",
				"border-color-b",
				"border-color-l"
			],
			"border-color-x": ["border-color-r", "border-color-l"],
			"border-color-y": ["border-color-t", "border-color-b"],
			translate: [
				"translate-x",
				"translate-y",
				"translate-none"
			],
			"translate-none": [
				"translate",
				"translate-x",
				"translate-y",
				"translate-z"
			],
			"scroll-m": [
				"scroll-mx",
				"scroll-my",
				"scroll-ms",
				"scroll-me",
				"scroll-mbs",
				"scroll-mbe",
				"scroll-mt",
				"scroll-mr",
				"scroll-mb",
				"scroll-ml"
			],
			"scroll-mx": ["scroll-mr", "scroll-ml"],
			"scroll-my": ["scroll-mt", "scroll-mb"],
			"scroll-p": [
				"scroll-px",
				"scroll-py",
				"scroll-ps",
				"scroll-pe",
				"scroll-pbs",
				"scroll-pbe",
				"scroll-pt",
				"scroll-pr",
				"scroll-pb",
				"scroll-pl"
			],
			"scroll-px": ["scroll-pr", "scroll-pl"],
			"scroll-py": ["scroll-pt", "scroll-pb"],
			touch: [
				"touch-x",
				"touch-y",
				"touch-pz"
			],
			"touch-x": ["touch"],
			"touch-y": ["touch"],
			"touch-pz": ["touch"]
		},
		conflictingClassGroupModifiers: { "font-size": ["leading"] },
		postfixLookupClassGroups: ["container-type"],
		orderSensitiveModifiers: [
			"*",
			"**",
			"after",
			"backdrop",
			"before",
			"details-content",
			"file",
			"first-letter",
			"first-line",
			"marker",
			"placeholder",
			"selection"
		]
	};
};
var twMerge = /* @__PURE__ */ createTailwindMerge(getDefaultConfig);
function cn(...inputs) {
	return twMerge(clsx(inputs));
}
var TooltipProvider = Provider;
var TooltipContent = import_react.forwardRef(({ className, sideOffset = 4, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Portal$1, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Content2, {
	ref,
	sideOffset,
	className: cn("z-50 overflow-hidden rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-[--radix-tooltip-content-transform-origin]", className),
	...props
}) }));
TooltipContent.displayName = Content2.displayName;
const AppWrapper = ({ children }) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HelmetProvider, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TooltipProvider, { children }) });
init$1({
	dsn: {
		"BASE_URL": "/",
		"DEV": false,
		"MODE": "production",
		"PROD": true,
		"SSR": false,
		"VITE_APP_ID": "app-dsyuoa7vbm69",
		"VITE_SANDBOX_SENTRY_DSN": "https://f552456bf8873936885193033f8c0c19@sentry.miaoda.cn/108",
		"VITE_SANDBOX_URL": "http://agentos-sandbox.bj.bcebos.com/vite-sandbox/online/output.tar.gz?authorization=bce-auth-v1%2FALTAKgwKYHlKIlKbjxxPYJDN6g%2F2025-09-04T11%3A32%3A45Z%2F-1%2Fhost%2Fbc1b06a04e9a745fdf77c966995ad9c3939599f98c5aa1bfae15ce4ccb52e698",
		"VITE_SUPABASE_ANON_KEY": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoyMTAyNDI3MDA2LCJpc3MiOiJzdXBhYmFzZSIsInJvbGUiOiJhbm9uIiwic3ViIjoiYW5vbiJ9.1HLE6UmlAJRNREaB1_dGglD8bPBzUNhym_5dl9ttZPU",
		"VITE_SUPABASE_URL": "https://backend.appmiaoda.com/projects/supabase348126418363789312"
	}["VITE_SENTRY_DSN"],
	environment: "production"
});
(0, import_client.createRoot)(document.getElementById("root")).render(/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ErrorBoundary, {
	fallback: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "应用发生错误，请刷新页面重试" }),
	children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppWrapper, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(App_default, {}) })
}));
