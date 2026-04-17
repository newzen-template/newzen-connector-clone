import { NEWGEN_MESSAGE, TYPE_SERVICE } from "./constants";

interface IFunction {
  (...args: any[]): any;
}

export default class NewzenConnector {

  _formattedPage = null;
  callback: IFunction;

  constructor({ callback, initialData }: { callback: IFunction, initialData: any }) {
    // this.actionHandler();
    this.callback = callback;
    this._formattedPage = initialData ?? null;
  }

  actionHandler = () => {
    const createButton = (text: string, dataCmsBind: any) => {
      const button = document.createElement('div');
      button.textContent = text;
      button.addEventListener('click', () => {
        const messageType = `newzen:template:${text.toLowerCase()}Block`;
        window.parent.postMessage({ type: messageType, data: dataCmsBind }, '*');
      });
      return button;
    };
    const createBlockNavigator = (section: HTMLDivElement) => {
      const div = document.createElement('div');
      if (this._formattedPage) {
        div.classList.add('block-navigator');
        const buttons = ['Edit', 'Up', 'Down', 'Delete'];
        buttons.forEach((buttonText) => {
          const button = createButton(buttonText, section.dataset.cmsBind);
          div.appendChild(button);
        });
      }
      return div;
    };
    const handleMouseEvents = (event: any, isMouseOver: boolean) => {
      const section = event.target.closest('[data-cms-bind^="#content_blocks"]');
      if (!section) {
        return
      }
      section.classList.toggle('content-block--hover', isMouseOver);
      const searchParams = new URLSearchParams(window.location.search);
      const edit = searchParams.has('edit');
      if (window.location !== window.parent.location && edit) {
        // The page is in an iFrames
        section.classList.remove('hidden-block-navigator')
      } else {
        // The page is not in an iFrame
        section.classList.add('hidden-block-navigator')
      }
      const nav = section.querySelector('.block-navigator');
      if (nav?.contains(event.relatedTarget)) {
        return
      }
      if (isMouseOver && !nav) {
        section.appendChild(createBlockNavigator(section));
        return;
      }
      if (!isMouseOver && nav) {
        section.removeChild(nav);
      }
    };
    document.body.addEventListener('mouseover', (event: any) => handleMouseEvents(event, true));
    document.body.addEventListener('mouseout', (event: any) => handleMouseEvents(event, false));
    window.addEventListener('message', (event) => {
      const { type, data } = event.data;
      switch (type) {
        case NEWGEN_MESSAGE.TEMPLATE_SCROLL_TO_SECTION: {
          const div = document.querySelector(`[data-cms-bind="#content_blocks.${data - 1}"]`) as HTMLDivElement;
          if (!div) {
            return
          }
          const divOffset = div.offsetTop;
          const offset = (document.querySelector('header') as HTMLDivElement).offsetHeight || 0;
          window.scrollTo({ top: divOffset - offset, behavior: 'smooth' });
          break;
        }
        case NEWGEN_MESSAGE.UPDATE: {
          this._formattedPage = NewzenConnector.formatContentBlock(JSON.parse(data));
          this.callback!(this._formattedPage);
          break;
        }
        // update height of iframe(plugin iframe)
        // case NEWGEN_MESSAGE.TEMPLATE_HEIGHT: {
        //   const height = document.body.scrollHeight;
        //   console.log('height in connector', height);
        //   window?.parent?.postMessage({ type: NEWGEN_MESSAGE.TEMPLATE_HEIGHT, data: height }, '*');
        //   break;
        // }
      }
    });
    window?.parent?.postMessage({ type: NEWGEN_MESSAGE.SITE_LOADED, data: {} }, '*');
    NewzenConnector.setupInlineEditing();
  }

  static formatContentBlock = (pageObject: any) => {
    pageObject.content_blocks.forEach(function (item: any) {
      item._block_name = item._block_name
        .replaceAll(/[^a-zA-Z0-9 ]/g, ' ')
        .replaceAll(/(^\w)|(\s+\w)/g, (c: string) => c.toUpperCase())
        .replaceAll(' ', '');
    });
    return pageObject;
  };
  // Edit line block functions
  static parseDataBinding = (dataCmsBind: string) => {
    try {
      const match = dataCmsBind.match(/#content_blocks\.(\d+)(?:\.(.+))?/);
      if (!match) return null;

      const blockIndex = Number(match[1] ?? NaN);
      if (Number.isNaN(blockIndex)) return null;
      const fieldPath = match[2] || null;

      return { blockIndex, fieldPath };
    } catch (error) {
      console.error('[NewzenConnector] Error parsing data-cms-bind:', error);
      return null;
    }
  };
  static isEditMode = () => {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      return searchParams.has('edit');
    } catch {
      return false;
    }
  };
  static emitInlineEdit = (dataCmsBind: string, newValue: string, fieldPath: string, messageType: string, element?: HTMLElement) => {
    try {
      if (!dataCmsBind || !fieldPath) return;

      const parsed = NewzenConnector.parseDataBinding(dataCmsBind);
      if (!parsed) return;

      // Get element rect for positioning
      let elementRect = null;
      if (element) {
        const rect = element.getBoundingClientRect();
        // Convert DOMRect to plain object (required for postMessage)
        elementRect = {
          top: rect.top,
          left: rect.left,
          right: rect.right,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height,
          x: rect.x,
          y: rect.y,
        };
      }

      const dataToSend = {
        blockIndex: parsed.blockIndex,
        fieldPath: fieldPath || parsed.fieldPath,
        value: newValue,
        dataCmsBind: dataCmsBind,
        elementRect: elementRect,
      };
      console.log('dataToSend', dataToSend);
      window.parent.postMessage(
        {
          type: messageType,
          data: dataToSend
        },
        '*'
      );
    } catch (error) {
      console.error('[NewzenConnector] Error emitting inline edit:', error);
    }
  };

  static setupEditableElement = (element: HTMLElement | null, fieldPath: string) => {
    if (!element) return () => undefined;

    const editableElement = element as HTMLElement & {
      __newzenEditableCleanup?: () => void;
      __toolbarButton?: HTMLDivElement;
    };

    if (editableElement.dataset.newzenEditableInited === '1') {
      return editableElement.__newzenEditableCleanup || (() => undefined);
    }

    editableElement.contentEditable = 'true';
    editableElement.classList.add('editable-field');
    editableElement.dataset.newzenEditableInited = '1';

    // Save original value to compare on blur
    let originalValue = element.textContent || '';

    // Create toolbar button (reusable)
    const createToolbarButton = (dataCmsBind: string) => {
      const button = document.createElement('div');
      button.textContent = 'Edit with Toolbar';
      button.classList.add('editable-toolbar-button');

      button.addEventListener('click', () => {
        if (dataCmsBind) {
          const newValue = editableElement.textContent || '';
          NewzenConnector.emitInlineEdit(dataCmsBind, newValue, fieldPath, NEWGEN_MESSAGE.TEMPLATE_EDIT_INLINE_BLOCK_WITH_TOOLBAR, editableElement);
        }
      });

      return button;
    };

    const handleBlur = () => {
      const newValue = editableElement.textContent || '';
      const dataCmsBind = editableElement.closest('[data-cms-bind]')?.getAttribute('data-cms-bind');

      if (newValue !== originalValue && dataCmsBind) {
        NewzenConnector.emitInlineEdit(dataCmsBind, newValue, fieldPath, NEWGEN_MESSAGE.TEMPLATE_EDIT_INLINE_BLOCK, editableElement);
      }

      editableElement.classList.remove('editable-field--editing');
    };

    const handleFocus = () => {
      originalValue = editableElement.textContent || '';
      editableElement.classList.add('editable-field--editing');
    };

    const toolbarMap = new WeakMap<HTMLElement, HTMLElement>();

    const handleMouseEnter = () => {
      if (editableElement.classList.contains('editable-field--editing')) return;

      editableElement.classList.add('editable-field--hover');

      const dataCmsBind = editableElement
        .closest('[data-cms-bind]')
        ?.getAttribute('data-cms-bind');

      if (!dataCmsBind) return;

      if (!toolbarMap.has(editableElement)) {
        const toolbar = createToolbarButton(dataCmsBind);
        toolbarMap.set(editableElement, toolbar);
        editableElement.appendChild(toolbar);
      }
    };

    const handleMouseLeave = () => {
      if (editableElement.classList.contains('editable-field--editing')) return;

      editableElement.classList.remove('editable-field--hover');

      const toolbar = toolbarMap.get(editableElement);
      if (toolbar) {
        toolbar.remove();
        toolbarMap.delete(editableElement);
      }
    };

    const handleKeydown = (e: KeyboardEvent) => {
      // Ctrl+Enter or Cmd+Enter: save edit
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        editableElement.blur();
      }
      // Escape: cancel edit
      if (e.key === 'Escape') {
        editableElement.textContent = originalValue;
        editableElement.blur();
      }
    };

    const handleBlurAfterFocus = () => {
      editableElement.classList.remove('editable-field--editing');
      handleBlur();
    };

    editableElement.addEventListener('blur', handleBlurAfterFocus);
    editableElement.addEventListener('focus', handleFocus);
    editableElement.addEventListener('mouseenter', handleMouseEnter);
    editableElement.addEventListener('mouseleave', handleMouseLeave);
    editableElement.addEventListener('keydown', handleKeydown);

    // Return cleanup function
    const cleanup = () => {
      editableElement.removeEventListener('blur', handleBlurAfterFocus);
      editableElement.removeEventListener('focus', handleFocus);
      editableElement.removeEventListener('mouseenter', handleMouseEnter);
      editableElement.removeEventListener('mouseleave', handleMouseLeave);
      editableElement.removeEventListener('keydown', handleKeydown);
      
      // Clean up toolbar button if exists
      const toolbar = toolbarMap.get(editableElement);
      if (toolbar && toolbar.parentElement) {
        toolbar.remove();
      }
      toolbarMap.delete(editableElement);
      
      editableElement.removeAttribute('data-newzen-editable-inited');
      delete editableElement.__newzenEditableCleanup;
    };

    editableElement.__newzenEditableCleanup = cleanup;
    return cleanup;
  };

  static setupInlineEditing = () => {
    if (!NewzenConnector.isEditMode()) return;

    // Find all elements with data-editable-field attribute
    const editableElements = document.querySelectorAll('[data-editable-field]');
    
    editableElements.forEach((element: Element) => {
      const fieldPath = (element as HTMLElement).getAttribute('data-editable-field');
      if (fieldPath) {
        NewzenConnector.setupEditableElement(element as HTMLElement, fieldPath);
      }
    });
  };
  
  static calPriceService = (inputPrice: string, taxPercent: number, typePrice: TYPE_SERVICE): string => {
    // Returns empty string if no input price
    if (!inputPrice) {
      return "";
    }
    // Price includes tax
    const calculatePriceWithTax = (price: string): number => {
      const priceValue = parseFloat(price);
      const taxAmount = (priceValue * taxPercent) / 100;
      return priceValue + taxAmount;
    };
  
    // Handling price chains with taxes
    const priceCard = inputPrice.replace(
      /\$(\d+(\.\d+)?)/g,
      (_, price: string) =>
        `$${calculatePriceWithTax(price).toFixed(2)}`
    );
  
    // Returns price based on price type
    const priceOptions  = {
      [TYPE_SERVICE.CASH]: inputPrice,
      [TYPE_SERVICE.CARD]: priceCard,
      [TYPE_SERVICE.Both]: `${inputPrice} | ${priceCard}`,
    };

    return priceOptions[typePrice] ?? priceOptions[TYPE_SERVICE.Both];
  };
}
