export enum NEWGEN_MESSAGE {
  INIT = 'newzen:init',
  UPDATE = 'newzen:update',
  TEMPLATE_UP_BLOCK = 'newzen:template:upBlock',
  TEMPLATE_DOWN_BLOCK = 'newzen:template:downBlock',
  TEMPLATE_DELETE_BLOCK = 'newzen:template:deleteBlock',
  TEMPLATE_EDIT_BLOCK = 'newzen:template:editBlock',
  TEMPLATE_EDIT_INLINE_BLOCK = 'newzen:template:editInlineBlock',
  TEMPLATE_EDIT_INLINE_BLOCK_WITH_TOOLBAR = 'newzen:template:editInlineBlockWithToolbar',
  TEMPLATE_SCROLL_TO_SECTION = 'newzen:scrollToSection',
  SITE_LOADED = 'newzen:site-loaded',
  TEMPLATE_HEIGHT = 'newzen:template:height',
} 

export enum TYPE_SERVICE{
  CASH = "Price Cash Only",
  CARD = "Price Card Only",
  Both = "Both"
}
