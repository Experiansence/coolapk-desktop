<template>
  <div
    class="app-shell"
    :class="{
      'has-mobile-window-controls': showWindowControls,
      'is-android': isAndroidApp,
      'is-touch-mobile': isTouchMobilePlatform(),
      'prevent-mobile-layout': isMobileLayoutDisabled,
      'has-mobile-bottom-nav': showMobileBottomNav,
    }"
  >
    <NetworkStatusBanner />
    <TopBar />
    <MobileTopBar
      v-if="!isMobileLayoutDisabled && !route.path.startsWith('/my-plugins')"
      :navigation-open="mobileNavigationOpen"
      :mac-overlay="usesMacOverlay"
      @toggle-navigation="toggleMobileNavigation"
    />
    <div class="app-body">
      <MainSidebar
        :mobile-open="isMobileLayoutDisabled ? false : mobileNavigationOpen"
        :mobile-window-controls="showWindowControls"
        @close-mobile="closeMobileNavigation"
      />
      <div class="app-content-column">
        <PageTabBar v-if="settingsStore.settings.showPageTabBar" />
        <main ref="mainContent" class="app-main-content">
          <slot></slot>
        </main>
      </div>
    </div>
    <MobileBottomNav v-if="showMobileBottomNav" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { isTauri } from '@tauri-apps/api/core';
import { useRoute, useRouter } from 'vue-router';
import TopBar from './TopBar.vue';
import MainSidebar from './MainSidebar.vue';
import NetworkStatusBanner from '../common/NetworkStatusBanner.vue';
import MobileTopBar from './MobileTopBar.vue';
import MobileBottomNav from './MobileBottomNav.vue';
import PageTabBar from './PageTabBar.vue';
import { useAndroidBackButton } from '../../utils/androidBackButton';
import { createAndroidRootBackHandler } from '../../utils/androidRootBack';
import { CoolapkTauriAPI } from '../../api/coolapk';
import { showToast } from '../../utils/toast';
import { isTouchMobilePlatform } from '../../utils/platform';
import { useDesktopWindow } from '../../composables/useDesktopWindow';
import { useSettingsStore } from '../../stores/settings';
import { useAppStore } from '../../stores/app';
import { useIosBackGesture } from '../../composables/useIosBackGesture';
import { navigateBack } from '../../utils/navigation';

const route = useRoute();
const router = useRouter();
const settingsStore = useSettingsStore();
const appStore = useAppStore();
const mobileNavigationOpen = ref(false);
const mainContent = ref<HTMLElement | null>(null);
const isIos = isTouchMobilePlatform() && !/android/i.test(navigator.userAgent);
useIosBackGesture(mainContent, () => isIos
  && !['/', '/digital', '/discover', '/me'].includes(route.path)
  && !mobileNavigationOpen.value
  && !appStore.isSearchOpen && !appStore.isPublishOpen && !appStore.activeImageViewer
  && !document.querySelector('.dialog-wrapper, .more-menu, .login-overlay, .app-context-menu'),
  () => navigateBack(router));
const isAndroidApp = isTauri() && /android/i.test(navigator.userAgent);
const { showWindowControls, usesMacOverlay } = useDesktopWindow();
// disableAutoMobileMode 是桌面端语义（窄窗口仍保留桌面顶栏与侧边栏）。
// 手机上窗口永远是窄的，一旦生效会把整个移动外壳删掉，因此触摸移动端一律忽略它。
const isMobileLayoutDisabled = computed(() => {
  return !isTouchMobilePlatform() && Boolean(settingsStore.settings.disableAutoMobileMode);
});
// 仅四个主栏目保留底栏；子页面通过顶栏返回，避免遮挡内容。
const showMobileBottomNav = computed(() => !isMobileLayoutDisabled.value
  && ['/', '/digital', '/discover', '/me'].includes(route.path));

function toggleMobileNavigation() {
  mobileNavigationOpen.value = !mobileNavigationOpen.value;
}

function closeMobileNavigation() {
  mobileNavigationOpen.value = false;
}

const rootBack = createAndroidRootBackHandler(router, () => CoolapkTauriAPI.quitApp(), showToast);
useAndroidBackButton(() => true, rootBack.handle);
useAndroidBackButton(() => mobileNavigationOpen.value, closeMobileNavigation);

function handleMobileNavigationKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') closeMobileNavigation();
}

watch(() => route.fullPath, () => {
  closeMobileNavigation();
  rootBack.reset();
});

onMounted(() => window.addEventListener('keydown', handleMobileNavigationKeydown));
onUnmounted(() => window.removeEventListener('keydown', handleMobileNavigationKeydown));
</script>

<style scoped>
.app-shell {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background-color: var(--background);
}

.app-body {
  --page-tabbar-height: 38px;
  display: flex;
  flex: 1;
  overflow: hidden;
}

.app-main-content {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  position: relative;
  display: flex;
}

.app-content-column {
  display: flex;
  flex: 1;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
}

@media (min-width: 721px) {
  /* 触摸平板使用桌面顶栏时，给系统状态栏留出顶部安全区。 */
  .app-shell.is-touch-mobile::before {
    content: '';
    flex: 0 0 env(safe-area-inset-top, 0px);
    background: var(--titlebar-background);
  }

  .app-shell.is-touch-mobile :deep(.network-status-banner) {
    top: calc(var(--app-titlebar-height) + env(safe-area-inset-top, 0px));
  }
}

@media (max-width: 720px) {
  .app-shell:not(.prevent-mobile-layout) {
    position: relative;
    --mobile-bottom-overlay-space: env(safe-area-inset-bottom, 0px);
    --mobile-navigation-top: calc(var(--mobile-topbar-height) + env(safe-area-inset-top, 0px) + 8px);
  }

  .app-shell:not(.prevent-mobile-layout).has-mobile-window-controls {
    --mobile-navigation-top: calc(var(--mobile-window-controls-height) + var(--mobile-topbar-height) + 8px);
  }

  .app-shell:not(.prevent-mobile-layout).has-mobile-bottom-nav {
    --mobile-bottom-overlay-space: calc(var(--mobile-bottom-nav-height) + max(20px, env(safe-area-inset-bottom)) + 8px);
  }

  .app-shell:not(.prevent-mobile-layout) :deep(.top-bar),
  .app-shell:not(.prevent-mobile-layout) :deep(.page-tab-bar) {
    display: none !important;
  }

  /* 无系统标题栏的桌面平台在窄窗口仍需要最小化、最大化和关闭按钮。 */
  .app-shell:not(.prevent-mobile-layout).has-mobile-window-controls :deep(.top-bar.has-window-controls) {
    display: flex !important;
    flex: 0 0 var(--mobile-window-controls-height);
    height: var(--mobile-window-controls-height);
    min-height: var(--mobile-window-controls-height);
  }

  .app-shell:not(.prevent-mobile-layout).has-mobile-window-controls :deep(.top-bar.has-window-controls > .titlebar-sidebar-offset),
  .app-shell:not(.prevent-mobile-layout).has-mobile-window-controls :deep(.top-bar.has-window-controls > .top-bar-center),
  .app-shell:not(.prevent-mobile-layout).has-mobile-window-controls :deep(.top-bar.has-window-controls > .top-bar-right) {
    display: none !important;
  }

  .app-shell:not(.prevent-mobile-layout).has-mobile-window-controls :deep(.top-bar.has-window-controls > .window-controls) {
    height: var(--mobile-window-controls-height);
  }

  .app-shell:not(.prevent-mobile-layout).has-mobile-window-controls :deep(.network-status-banner) {
    top: calc(var(--mobile-window-controls-height) + var(--mobile-topbar-height));
  }

  /* 移动端顶栏自身会因为安全区变高（iPhone 上约 99px），横幅必须让开它。 */
  .app-shell:not(.prevent-mobile-layout):not(.has-mobile-window-controls) :deep(.network-status-banner) {
    top: calc(var(--mobile-topbar-height) + env(safe-area-inset-top, 0px) + 8px);
  }

  .app-shell:not(.prevent-mobile-layout) :deep(.main-sidebar) {
    display: flex !important;
    position: absolute;
    top: var(--mobile-navigation-top);
    bottom: auto;
    left: 50%;
    z-index: 1001;
    width: min(460px, calc(100vw - 24px)) !important;
    height: max-content;
    max-height: calc(100% - var(--mobile-navigation-top) - var(--mobile-bottom-overlay-space) - 12px);
    transform: translate(-50%, -8px);
    visibility: hidden;
    pointer-events: none;
    box-shadow: var(--shadow-lg);
    border: 1px solid var(--border-light);
    border-radius: var(--radius-card);
    overflow: hidden;
    transition: transform var(--duration-normal) var(--ease-default), visibility var(--duration-normal), opacity var(--duration-normal);
    opacity: 0;
  }

  .app-shell:not(.prevent-mobile-layout).has-mobile-window-controls :deep(.main-sidebar.has-window-controls) {
    top: var(--mobile-navigation-top);
  }

  .app-shell:not(.prevent-mobile-layout) :deep(.main-sidebar.is-mobile-open) {
    transform: translate(-50%, 0);
    visibility: visible;
    pointer-events: auto;
    opacity: 1;
  }

  .app-shell:not(.prevent-mobile-layout) :deep(.main-sidebar.is-mobile-open .mobile-navigation-header) {
    display: flex;
    flex: 0 0 auto;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
    padding: 14px 16px 8px;
    color: var(--text-primary);
  }

  .app-shell:not(.prevent-mobile-layout) :deep(.main-sidebar.is-mobile-open .mobile-navigation-header strong) {
    font-size: 16px;
    font-weight: 700;
  }

  .app-shell:not(.prevent-mobile-layout) :deep(.main-sidebar.is-mobile-open .mobile-navigation-header span) {
    color: var(--text-tertiary);
    font-size: 12px;
  }

  .app-shell:not(.prevent-mobile-layout) :deep(.main-sidebar.is-mobile-open .sidebar-nav) {
    display: grid !important;
    flex: 0 1 auto;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    align-content: start;
    gap: 8px;
    min-height: 0;
    width: 100%;
    padding: 12px;
    overflow-y: auto;
  }

  .app-shell:not(.prevent-mobile-layout) :deep(.main-sidebar.is-mobile-open .nav-group) {
    display: contents;
  }

  .app-shell:not(.prevent-mobile-layout) :deep(.main-sidebar.is-mobile-open .nav-item) {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center !important;
    gap: 5px;
    width: 100%;
    height: 60px;
    padding: 6px 4px !important;
    border: 1px solid var(--border-light);
    border-radius: 13px;
    background: var(--surface-hover);
    font-size: 12px;
  }

  .app-shell:not(.prevent-mobile-layout) :deep(.main-sidebar.is-mobile-open .nav-label) {
    display: inline !important;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .app-shell:not(.prevent-mobile-layout) :deep(.main-sidebar.is-mobile-open .nav-item.is-active::before) {
    display: none;
  }

  .app-shell:not(.prevent-mobile-layout) :deep(.main-sidebar.is-mobile-open .nav-icon) {
    width: auto;
    margin: 0 !important;
    font-size: 18px;
  }

  .app-shell:not(.prevent-mobile-layout) :deep(.main-sidebar.is-mobile-open .nav-divider) {
    display: block;
    grid-column: 1 / -1;
    width: auto;
    height: 1px;
    margin: 2px 0;
  }

  .app-shell:not(.prevent-mobile-layout) :deep(.main-sidebar.is-mobile-open .sidebar-footer) {
    display: flex !important;
    flex: 0 0 auto;
    padding: 12px;
  }

  .app-shell:not(.prevent-mobile-layout) :deep(.main-sidebar.is-mobile-open .app-info-card) {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 10px;
    width: 100%;
  }

  .app-shell:not(.prevent-mobile-layout) :deep(.main-sidebar.is-mobile-open .app-info-top) {
    grid-column: 1 / -1;
    justify-content: flex-start;
    gap: 8px;
  }

  .app-shell:not(.prevent-mobile-layout) :deep(.main-sidebar.is-mobile-open .app-info-actions) {
    min-width: 0;
    gap: 8px;
  }

  .app-shell:not(.prevent-mobile-layout) :deep(.main-sidebar.is-mobile-open .footer-action-btn) {
    min-width: 0;
    min-height: 44px;
    padding: 8px;
    border-radius: 10px;
    font-size: 12px;
  }

  .app-shell:not(.prevent-mobile-layout) :deep(.main-sidebar.is-mobile-open .beta-toggle-btn) {
    gap: 6px;
    flex-wrap: wrap;
  }

  .app-shell:not(.prevent-mobile-layout) :deep(.main-sidebar.is-mobile-open .nav-badge) {
    position: absolute;
    top: 3px;
    right: 6px;
    left: auto;
    margin: 0;
  }

  .app-shell:not(.prevent-mobile-layout) :deep(.sidebar-floating-toggle-btn) {
    display: none;
  }

  .app-body,
  .app-main-content {
    min-height: 0;
  }

  .app-main-content {
    width: 100%;
    overscroll-behavior: none;
  }
}
</style>
