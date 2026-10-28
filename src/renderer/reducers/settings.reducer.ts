import { AuthData } from '../../main/auth';
import { Settings, VisualizationType } from '../../models/settings';

export enum SettingsActionType {
  SetVisualization = 'setVisualization',
  SetVisualizationType = 'setVisualizationType',
  SetWindowPos = 'setWindowPos',
  SetWindowSize = 'setWindowSize',
  SetTokens = 'setTokens',
  ResetTokens = 'resetTokens',
  SetOnboarded = 'setOnboarded',
  UpdateSettings = 'updateSettings',
}

export type SettingsAction =
  | {
      type: SettingsActionType.SetVisualization;
      payload: number;
    }
  | {
      type: SettingsActionType.SetVisualizationType;
      payload: VisualizationType;
    }
  | {
      type: SettingsActionType.SetWindowPos;
      payload: { x: number; y: number };
    }
  | {
      type: SettingsActionType.SetWindowSize;
      payload: { width: number; height: number };
    }
  | {
      type: SettingsActionType.SetTokens;
      payload: AuthData;
    }
  | {
      type: SettingsActionType.ResetTokens;
    }
  | {
      type: SettingsActionType.SetOnboarded;
    }
  | {
      type: SettingsActionType.UpdateSettings;
      payload: Settings;
    };

export const useSettingsReducer = (state: Settings, action: SettingsAction): Settings => {
  switch (action.type) {
    case SettingsActionType.SetVisualization: {
      return {
        ...state,
        visualizationId: action.payload,
      };
    }

    case SettingsActionType.SetVisualizationType: {
      return {
        ...state,
        visualizationType: action.payload,
      };
    }

    case SettingsActionType.SetWindowPos: {
      return {
        ...state,
        x: action.payload.x,
        y: action.payload.y,
      };
    }

    case SettingsActionType.SetWindowSize: {
      return {
        ...state,
        width: action.payload.width,
        height: action.payload.height,
      };
    }

    case SettingsActionType.SetTokens: {
      return {
        ...state,
        accessToken: action.payload.access_token,
        refreshToken: action.payload.refresh_token,
      };
    }

    case SettingsActionType.ResetTokens: {
      return {
        ...state,
        accessToken: '',
        refreshToken: '',
      };
    }

    case SettingsActionType.SetOnboarded: {
      return state.isOnboarded ? state : { ...state, isOnboarded: true };
    }

    case SettingsActionType.UpdateSettings: {
      return {
        ...state,
        ...action.payload,
      };
    }

    default: {
      return state;
    }
  }
};
