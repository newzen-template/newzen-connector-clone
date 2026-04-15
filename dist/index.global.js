"use strict";
(() => {
  // src/index.ts
  var _NewzenConnector = class _NewzenConnector {
    constructor({ callback, initialData }) {
      this._formattedPage = null;
      this.actionHandler = () => {
        var _a;
        const createButton = (text, dataCmsBind) => {
          const button = document.createElement("div");
          button.textContent = text;
          button.addEventListener("click", () => {
            const messageType = `newzen:template:${text.toLowerCase()}Block`;
            window.parent.postMessage({ type: messageType, data: dataCmsBind }, "*");
          });
          return button;
        };
        const createBlockNavigator = (section) => {
          const div = document.createElement("div");
          if (this._formattedPage) {
            div.classList.add("block-navigator");
            const buttons = ["Edit", "Up", "Down", "Delete"];
            buttons.forEach((buttonText) => {
              const button = createButton(buttonText, section.dataset.cmsBind);
              div.appendChild(button);
            });
          }
          return div;
        };
        const handleMouseEvents = (event, isMouseOver) => {
          const section = event.target.closest('[data-cms-bind^="#content_blocks"]');
          if (!section) {
            return;
          }
          section.classList.toggle("content-block--hover", isMouseOver);
          const searchParams = new URLSearchParams(window.location.search);
          const edit = searchParams.has("edit");
          if (window.location !== window.parent.location && edit) {
            section.classList.remove("hidden-block-navigator");
          } else {
            section.classList.add("hidden-block-navigator");
          }
          const nav = section.querySelector(".block-navigator");
          if (nav == null ? void 0 : nav.contains(event.relatedTarget)) {
            return;
          }
          if (isMouseOver && !nav) {
            section.appendChild(createBlockNavigator(section));
            return;
          }
          if (!isMouseOver && nav) {
            section.removeChild(nav);
          }
        };
        document.body.addEventListener("mouseover", (event) => handleMouseEvents(event, true));
        document.body.addEventListener("mouseout", (event) => handleMouseEvents(event, false));
        window.addEventListener("message", (event) => {
          const { type, data } = event.data;
          switch (type) {
            case "newzen:scrollToSection" /* TEMPLATE_SCROLL_TO_SECTION */: {
              const div = document.querySelector(`[data-cms-bind="#content_blocks.${data - 1}"]`);
              if (!div) {
                return;
              }
              const divOffset = div.offsetTop;
              const offset = document.querySelector("header").offsetHeight || 0;
              window.scrollTo({ top: divOffset - offset, behavior: "smooth" });
              break;
            }
            case "newzen:update" /* UPDATE */: {
              this._formattedPage = _NewzenConnector.formatContentBlock(JSON.parse(data));
              this.callback(this._formattedPage);
              break;
            }
          }
        });
        (_a = window == null ? void 0 : window.parent) == null ? void 0 : _a.postMessage({ type: "newzen:site-loaded" /* SITE_LOADED */, data: {} }, "*");
        _NewzenConnector.setupInlineEditing();
      };
      this.callback = callback;
      this._formattedPage = initialData != null ? initialData : null;
    }
  };
  _NewzenConnector.formatContentBlock = (pageObject) => {
    pageObject.content_blocks.forEach(function(item) {
      item._block_name = item._block_name.replaceAll(/[^a-zA-Z0-9 ]/g, " ").replaceAll(/(^\w)|(\s+\w)/g, (c) => c.toUpperCase()).replaceAll(" ", "");
    });
    return pageObject;
  };
  // Edit line block functions
  _NewzenConnector.parseDataBinding = (dataCmsBind) => {
    var _a;
    try {
      const match = dataCmsBind.match(/#content_blocks\.(\d+)(?:\.(.+))?/);
      if (!match)
        return null;
      const blockIndex = Number((_a = match[1]) != null ? _a : NaN);
      if (Number.isNaN(blockIndex))
        return null;
      const fieldPath = match[2] || null;
      return { blockIndex, fieldPath };
    } catch (error) {
      console.error("[NewzenConnector] Error parsing data-cms-bind:", error);
      return null;
    }
  };
  _NewzenConnector.isEditMode = () => {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      return searchParams.has("edit");
    } catch (e) {
      return false;
    }
  };
  _NewzenConnector.emitInlineEdit = (dataCmsBind, newValue, fieldPath, messageType, element) => {
    try {
      if (!dataCmsBind || !fieldPath)
        return;
      const parsed = _NewzenConnector.parseDataBinding(dataCmsBind);
      if (!parsed)
        return;
      let elementRect = null;
      if (element) {
        const rect = element.getBoundingClientRect();
        elementRect = {
          top: rect.top,
          left: rect.left,
          right: rect.right,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height,
          x: rect.x,
          y: rect.y
        };
      }
      window.parent.postMessage(
        {
          type: messageType,
          data: {
            blockIndex: parsed.blockIndex,
            fieldPath: fieldPath || parsed.fieldPath,
            value: newValue,
            dataCmsBind,
            elementRect
            // Include element coordinates
          }
        },
        "*"
      );
    } catch (error) {
      console.error("[NewzenConnector] Error emitting inline edit:", error);
    }
  };
  _NewzenConnector.setupEditableElement = (element, fieldPath) => {
    if (!element)
      return () => void 0;
    const editableElement = element;
    if (editableElement.dataset.newzenEditableInited === "1") {
      return editableElement.__newzenEditableCleanup || (() => void 0);
    }
    editableElement.contentEditable = "true";
    editableElement.classList.add("editable-field");
    editableElement.dataset.newzenEditableInited = "1";
    let originalValue = element.textContent || "";
    const createToolbarButton = (dataCmsBind) => {
      const button = document.createElement("div");
      button.textContent = "Edit with Toolbar";
      button.classList.add("editable-toolbar-button");
      button.addEventListener("click", () => {
        if (dataCmsBind) {
          const newValue = editableElement.textContent || "";
          _NewzenConnector.emitInlineEdit(dataCmsBind, newValue, fieldPath, "newzen:template:editInlineBlockWithToolbar" /* TEMPLATE_EDIT_INLINE_BLOCK_WITH_TOOLBAR */, editableElement);
        }
      });
      return button;
    };
    const handleBlur = () => {
      var _a;
      const newValue = editableElement.textContent || "";
      const dataCmsBind = (_a = editableElement.closest("[data-cms-bind]")) == null ? void 0 : _a.getAttribute("data-cms-bind");
      if (newValue !== originalValue && dataCmsBind) {
        _NewzenConnector.emitInlineEdit(dataCmsBind, newValue, fieldPath, "newzen:template:editInlineBlock" /* TEMPLATE_EDIT_INLINE_BLOCK */, editableElement);
      }
      editableElement.classList.remove("editable-field--editing");
    };
    const handleFocus = () => {
      originalValue = editableElement.textContent || "";
      editableElement.classList.add("editable-field--editing");
    };
    const toolbarMap = /* @__PURE__ */ new WeakMap();
    const handleMouseEnter = () => {
      var _a;
      if (editableElement.classList.contains("editable-field--editing"))
        return;
      editableElement.classList.add("editable-field--hover");
      const dataCmsBind = (_a = editableElement.closest("[data-cms-bind]")) == null ? void 0 : _a.getAttribute("data-cms-bind");
      if (!dataCmsBind)
        return;
      if (!toolbarMap.has(editableElement)) {
        const toolbar = createToolbarButton(dataCmsBind);
        toolbarMap.set(editableElement, toolbar);
        editableElement.appendChild(toolbar);
      }
    };
    const handleMouseLeave = () => {
      if (editableElement.classList.contains("editable-field--editing"))
        return;
      editableElement.classList.remove("editable-field--hover");
      const toolbar = toolbarMap.get(editableElement);
      if (toolbar) {
        toolbar.remove();
        toolbarMap.delete(editableElement);
      }
    };
    const handleKeydown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        editableElement.blur();
      }
      if (e.key === "Escape") {
        editableElement.textContent = originalValue;
        editableElement.blur();
      }
    };
    const handleBlurAfterFocus = () => {
      editableElement.classList.remove("editable-field--editing");
      handleBlur();
    };
    editableElement.addEventListener("blur", handleBlurAfterFocus);
    editableElement.addEventListener("focus", handleFocus);
    editableElement.addEventListener("mouseenter", handleMouseEnter);
    editableElement.addEventListener("mouseleave", handleMouseLeave);
    editableElement.addEventListener("keydown", handleKeydown);
    const cleanup = () => {
      editableElement.removeEventListener("blur", handleBlurAfterFocus);
      editableElement.removeEventListener("focus", handleFocus);
      editableElement.removeEventListener("mouseenter", handleMouseEnter);
      editableElement.removeEventListener("mouseleave", handleMouseLeave);
      editableElement.removeEventListener("keydown", handleKeydown);
      const toolbar = toolbarMap.get(editableElement);
      if (toolbar && toolbar.parentElement) {
        toolbar.remove();
      }
      toolbarMap.delete(editableElement);
      editableElement.removeAttribute("data-newzen-editable-inited");
      delete editableElement.__newzenEditableCleanup;
    };
    editableElement.__newzenEditableCleanup = cleanup;
    return cleanup;
  };
  _NewzenConnector.setupInlineEditing = () => {
    if (!_NewzenConnector.isEditMode())
      return;
    const editableElements = document.querySelectorAll("[data-editable-field]");
    editableElements.forEach((element) => {
      const fieldPath = element.getAttribute("data-editable-field");
      if (fieldPath) {
        _NewzenConnector.setupEditableElement(element, fieldPath);
      }
    });
  };
  _NewzenConnector.calPriceService = (inputPrice, taxPercent, typePrice) => {
    var _a;
    if (!inputPrice) {
      return "";
    }
    const calculatePriceWithTax = (price) => {
      const priceValue = parseFloat(price);
      const taxAmount = priceValue * taxPercent / 100;
      return priceValue + taxAmount;
    };
    const priceCard = inputPrice.replace(
      /\$(\d+(\.\d+)?)/g,
      (_, price) => `$${calculatePriceWithTax(price).toFixed(2)}`
    );
    const priceOptions = {
      ["Price Cash Only" /* CASH */]: inputPrice,
      ["Price Card Only" /* CARD */]: priceCard,
      ["Both" /* Both */]: `${inputPrice} | ${priceCard}`
    };
    return (_a = priceOptions[typePrice]) != null ? _a : priceOptions["Both" /* Both */];
  };
  var NewzenConnector = _NewzenConnector;
})();
//# sourceMappingURL=index.global.js.map