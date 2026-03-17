import React, {type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {
  useLockBodyScroll,
  useNavbarMobileSidebar,
} from '@docusaurus/theme-common/internal';
import NavbarLogo from '@theme/Navbar/Logo';
import IconClose from '@theme/Icon/Close';
import {translate} from '@docusaurus/Translate';
import {useNavbarSecondaryMenu} from '@docusaurus/theme-common/internal';
import {useThemeConfig} from '@docusaurus/theme-common';
import NavbarItem, {type Props as NavbarItemConfig} from '@theme/NavbarItem';
import BrowserOnly from '@docusaurus/BrowserOnly';

function useNavbarItems() {
  return useThemeConfig().navbar.items as NavbarItemConfig[];
}

function MobileSidebarPortal(): ReactNode {
  const mobileSidebar = useNavbarMobileSidebar();
  const secondaryMenu = useNavbarSecondaryMenu();
  const items = useNavbarItems();
  useLockBodyScroll(mobileSidebar.shown);

  if (!mobileSidebar.shouldRender) {
    return null;
  }

  const content = (
    <>
      {/* Backdrop */}
      {mobileSidebar.shown && (
        <div
          role="presentation"
          onClick={() => mobileSidebar.toggle()}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 99998,
            background: 'rgba(0,0,0,0.7)',
          }}
        />
      )}

      {/* Sidebar drawer */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          width: '80vw',
          maxWidth: '350px',
          zIndex: 99999,
          background: '#000000',
          display: 'flex',
          flexDirection: 'column',
          transform: mobileSidebar.shown
            ? 'translateX(0)'
            : 'translateX(-100%)',
          transition: 'transform 0.2s ease-in-out',
          borderRight: '1px solid #2a2a2a',
        }}>
        {/* Header: logo + close */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderBottom: '1px solid #2a2a2a',
            flexShrink: 0,
          }}>
          <NavbarLogo />
          <button
            type="button"
            aria-label={translate({
              id: 'theme.docs.sidebar.closeSidebarButtonAriaLabel',
              message: 'Close navigation bar',
            })}
            onClick={() => mobileSidebar.toggle()}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
            }}>
            <IconClose color="#888888" />
          </button>
        </div>

        {/* Scrollable content */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '8px 0',
          }}>
          {/* Doc sidebar */}
          <div style={{padding: '0 8px'}}>
            {secondaryMenu.content}
          </div>

          {/* Navbar links */}
          <div
            style={{
              borderTop: '1px solid #2a2a2a',
              marginTop: '12px',
              paddingTop: '12px',
            }}>
            <ul className="menu__list" style={{padding: '0 8px'}}>
              {items.map((item, i) => (
                <NavbarItem
                  mobile
                  {...item}
                  onClick={() => mobileSidebar.toggle()}
                  key={i}
                />
              ))}
            </ul>
          </div>
        </div>
      </div>
    </>
  );

  return createPortal(content, document.body);
}

// BrowserOnly because createPortal needs document.body (not available during SSR)
export default function NavbarMobileSidebar(): ReactNode {
  return (
    <BrowserOnly>
      {() => <MobileSidebarPortal />}
    </BrowserOnly>
  );
}
