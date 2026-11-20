<script lang="ts">
export default {}
</script>

<style lang="scss">
/*
 * uni-app 不给自定义样式做 box-sizing 重置，组件默认是 content-box：
 * 一个 width 撑满的容器再加 padding 就会超出视口，页面横向滚动。
 */
uni-view,
uni-scroll-view,
uni-swiper,
uni-swiper-item,
uni-button,
uni-input,
uni-textarea,
uni-image,
uni-text {
  box-sizing: border-box;
}

/*
 * 滚动保持在文档层，这是 uni-app H5 的默认行为，不要改成内部容器滚动：
 * 下拉刷新依赖页面级滚动，而内部容器在 iOS 上回弹时会把 sticky 元素一起拉走。
 *
 * 只把滚动条藏掉——移动端系统的滚动条本来就是浮动的，滚动时才闪现、停下就消失，
 * 桌面浏览器却把它画成一根常驻的灰条，还会压在吸顶的品类栏上。
 */
html,
body,
page {
  scrollbar-width: none;
  -ms-overflow-style: none;
}

html::-webkit-scrollbar,
body::-webkit-scrollbar,
page::-webkit-scrollbar {
  display: none;
}

page {
  background: var(--bg);
  color: var(--ink);
  font-family: $font-stack;
  font-size: var(--fs-body);
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}

/* 只有五档字号，靠字重和颜色建立层级 */
.t-title  { font-size: var(--fs-title);  font-weight: 600; line-height: 1.3; }
.t-body   { font-size: var(--fs-body);   font-weight: 400; }
.t-action { font-size: var(--fs-action); font-weight: 500; }
.t-label  { font-size: var(--fs-label);  font-weight: 400; color: var(--ink-2); }
.t-tab    { font-size: var(--fs-tab);    font-weight: 400; }

.page-body { padding: var(--sp-4); }

.garment-surface {
  background-color: var(--canvas);
  background-image: linear-gradient(rgb(210 195 175 / 35%), rgb(210 195 175 / 35%)), url('./static/linen.webp');
  background-size: auto, 320px 320px;
}

.catalog-page {
  max-width: var(--content-width);
  padding-inline: var(--gutter);
  margin-inline: auto;
}

.catalog-header {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: var(--sp-3);
  padding: calc(18px + env(safe-area-inset-top, 0px)) 0 14px;
  border-bottom: 1px solid var(--line);
}

.catalog-wordmark {
  display: block;
  margin-bottom: 9px;
  font: 600 17px/1.2 Georgia, serif;
}

.catalog-heading {
  margin: 0;
  color: var(--ink);
  font: 600 32px/1.16 var(--font-display);
}

.catalog-action,
.text-action {
  min-height: 44px;
  border: 0;
  border-radius: var(--r-sm);
  padding: 0 14px;
  font: 500 var(--fs-action)/1.3 #{$font-stack};
  cursor: pointer;
}

.catalog-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  flex: 0 0 auto;
  background: var(--brand);
  color: var(--on-brand);
}

.action-icon { width: 17px; height: 17px; }

.text-action {
  padding-inline: 8px;
  background: transparent;
  color: var(--ink);

}

button:focus-visible {
  outline: 2px solid var(--brand);
  outline-offset: 3px;
}

@media (min-width: 680px) {
  .catalog-header { padding-top: 28px; }
}
</style>
