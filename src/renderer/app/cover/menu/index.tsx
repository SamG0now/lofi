import { ipcRenderer } from 'electron';
import React, { FunctionComponent, useCallback } from 'react';
import styled from 'styled-components';

import { IpcMessage } from '../../../../constants';
import { CloseButton } from '../../../components';

const MenuList = styled.ul`
  display: flex;
  z-index: 3;
  list-style-type: none;
  margin: 0;
  /* keeps clear of the window's rounded corners */
  padding: calc(4px + var(--corner-inset-y, 0px)) calc(4px + var(--corner-inset-x, 0px));
  overflow: hidden;
  font-size: 12px;
  opacity: 0;
  transition: opacity 0.25s ease-in-out;
  -moz-transition: opacity 0.25s ease-in-out;
  -webkit-transition: opacity 0.25s ease-in-out;
  position: absolute;
  left: 0;
  width: calc(100% - 8px - 2 * var(--corner-inset-x, 0px));

  .bottom {
    bottom: 0;
  }

  .top {
    top: 0;
  }

  li {
    width: 100%;
    display: flex;
    flex-direction: row;
    align-items: center;
    padding: 0.25rem;

    &.pull-right {
      display: flex;
      flex-direction: row-reverse;
    }

    button {
      color: white;
      text-align: center;
      text-decoration: none;
      text-shadow: 1px 1px 0px black;

      &.settings:hover {
        color: #979eff;
      }

      &.settings:active {
        color: #50569e;
      }

      &.vis-change {
        margin: 0 0.25rem;
      }

      &.vis:hover {
        color: #61eb9a;
      }

      &.vis:active {
        color: #3d9963;
      }

      &.help:hover {
        color: #fadfa4;
      }

      &.help:active {
        color: #b47f2e;
      }
    }

    .logo-typo {
      background-image: linear-gradient(90deg, white 25%, #f871fd 35%, #9771ef, #7e6a99 65%, white 85%);
      background-position: right center;
      background-size: 600% auto;
      -webkit-background-clip: text;
      background-clip: text;
      color: white;
      margin-left: 0.25rem;
      -webkit-text-fill-color: transparent;
      transition: color 200ms linear;
      text-shadow: 0px 0px 16px #0000003d;
    }
  }
`;

// Shown while logged out or when nothing plays, the player controls replace it otherwise
const Menu: FunctionComponent = () => {
  const handleCloseClick = useCallback(() => {
    ipcRenderer.send(IpcMessage.CloseApp);
  }, []);

  const handleSettingsClick = useCallback(() => {
    ipcRenderer.send(IpcMessage.ShowSettings);
  }, []);

  const handleAboutClick = useCallback(() => {
    ipcRenderer.send(IpcMessage.ShowAbout);
  }, []);

  return (
    <>
      <MenuList className="menu top draggable">
        <li className="draggable">
          <button type="button" onClick={handleSettingsClick} className="unstyled-button settings">
            <i className="fa fa-cog" />
          </button>
          <div className="logo-typo draggable">
            <span className="logo-typo draggable" style={{ fontWeight: 'bold' }}>
              lo
            </span>
            fi
          </div>
        </li>
        <li className="pull-right draggable">
          <CloseButton onClose={handleCloseClick} />
        </li>
      </MenuList>
      <MenuList className="menu bottom draggable">
        <li className="pull-right draggable">
          <button type="button" onClick={handleAboutClick} className="unstyled-button help">
            <i className="fa-solid fa-circle-question" />
          </button>
        </li>
      </MenuList>
    </>
  );
};

export default Menu;
