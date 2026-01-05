import { EventBus } from "../../core/EventBus";
import { GameView } from "../../core/game/GameView";
import { UserSettings } from "../../core/game/UserSettings";
import { GameStartingModal } from "../GameStartingModal";
import { Game3DRenderer } from "./Game3DRenderer";
import { InputHandler3D } from "./InputHandler3D";
import { BuildMenu } from "../graphics/layers/BuildMenu";
import { ControlPanel } from "../graphics/layers/ControlPanel";
import { EmojiTable } from "../graphics/layers/EmojiTable";
import { EventsDisplay } from "../graphics/layers/EventsDisplay";
import { ChatDisplay } from "../graphics/layers/ChatDisplay";
import { GameLeftSidebar } from "../graphics/layers/GameLeftSidebar";
import { GameRightSidebar } from "../graphics/layers/GameRightSidebar";
import { Leaderboard } from "../graphics/layers/Leaderboard";
import { PlayerInfoOverlay } from "../graphics/layers/PlayerInfoOverlay";
import { PlayerPanel } from "../graphics/layers/PlayerPanel";
import { ReplayPanel } from "../graphics/layers/ReplayPanel";
import { SettingsModal } from "../graphics/layers/SettingsModal";
import { TeamStats } from "../graphics/layers/TeamStats";
import { UnitDisplay } from "../graphics/layers/UnitDisplay";
import { WinModal } from "../graphics/layers/WinModal";
import { PerformanceOverlay } from "../graphics/layers/PerformanceOverlay";
import { HeadsUpMessage } from "../graphics/layers/HeadsUpMessage";
import { MultiTabModal } from "../graphics/layers/MultiTabModal";
import { AlertFrame } from "../graphics/layers/AlertFrame";
import { SpawnTimer } from "../graphics/layers/SpawnTimer";
import { ImmunityTimer } from "../graphics/layers/ImmunityTimer";
import { ChatModal } from "../graphics/layers/ChatModal";
import { MainRadialMenu } from "../graphics/layers/MainRadialMenu";
import { Layer } from "../graphics/layers/Layer";

/**
 * Creates a 3D game renderer with all UI components wired up
 */
export function create3DRenderer(
  canvas: HTMLCanvasElement,
  game: GameView,
  eventBus: EventBus
): { renderer: Game3DRenderer; inputHandler: InputHandler3D } {
  console.log("create3DRenderer: Starting");
  const userSettings = new UserSettings();

  // Create the 3D renderer
  console.log("create3DRenderer: Creating Game3DRenderer");
  const renderer = new Game3DRenderer({
    canvas,
    gameView: game,
    eventBus,
  });
  console.log("create3DRenderer: Game3DRenderer created");

  // Create the 3D input handler
  console.log("create3DRenderer: Creating InputHandler3D");
  const inputHandler = new InputHandler3D({
    canvas,
    camera: renderer.camera,
    controls: renderer.controls,
    transformHandler: renderer.transformHandler,
    gameView: game,
    eventBus,
  });
  console.log("create3DRenderer: InputHandler3D created");

  // Hide the starting modal
  const startingModal = document.querySelector(
    "game-starting-modal"
  ) as GameStartingModal;
  if (startingModal) {
    startingModal.hide();
  }

  // Collect UI layers that need init() and tick() calls
  const uiLayers: Layer[] = [];

  // Wire up UI components - they work with screen coordinates and use the transform handler
  const emojiTable = document.querySelector("emoji-table") as EmojiTable;
  if (emojiTable) {
    emojiTable.transformHandler = renderer.transformHandler as never;
    emojiTable.game = game;
    emojiTable.initEventBus(eventBus);
  }

  const buildMenu = document.querySelector("build-menu") as BuildMenu;
  if (buildMenu) {
    buildMenu.game = game;
    buildMenu.eventBus = eventBus;
    buildMenu.uiState = renderer.uiState;
    buildMenu.transformHandler = renderer.transformHandler as never;
    uiLayers.push(buildMenu);
  }

  const leaderboard = document.querySelector("leader-board") as Leaderboard;
  if (leaderboard) {
    leaderboard.eventBus = eventBus;
    leaderboard.game = game;
    uiLayers.push(leaderboard);
  }

  const gameLeftSidebar = document.querySelector(
    "game-left-sidebar"
  ) as GameLeftSidebar;
  if (gameLeftSidebar) {
    gameLeftSidebar.game = game;
    uiLayers.push(gameLeftSidebar);
  }

  const teamStats = document.querySelector("team-stats") as TeamStats;
  if (teamStats) {
    teamStats.eventBus = eventBus;
    teamStats.game = game;
    uiLayers.push(teamStats);
  }

  const controlPanel = document.querySelector("control-panel") as ControlPanel;
  if (controlPanel) {
    controlPanel.eventBus = eventBus;
    controlPanel.uiState = renderer.uiState;
    controlPanel.game = game;
    uiLayers.push(controlPanel);
  }

  const eventsDisplay = document.querySelector(
    "events-display"
  ) as EventsDisplay;
  if (eventsDisplay) {
    eventsDisplay.eventBus = eventBus;
    eventsDisplay.game = game;
    eventsDisplay.uiState = renderer.uiState;
    uiLayers.push(eventsDisplay);
  }

  const chatDisplay = document.querySelector("chat-display") as ChatDisplay;
  if (chatDisplay) {
    chatDisplay.eventBus = eventBus;
    chatDisplay.game = game;
    uiLayers.push(chatDisplay);
  }

  const playerInfo = document.querySelector(
    "player-info-overlay"
  ) as PlayerInfoOverlay;
  if (playerInfo) {
    playerInfo.eventBus = eventBus;
    playerInfo.transform = renderer.transformHandler as never;
    playerInfo.game = game;
    uiLayers.push(playerInfo);
  }

  const winModal = document.querySelector("win-modal") as WinModal;
  if (winModal) {
    winModal.eventBus = eventBus;
    winModal.game = game;
    uiLayers.push(winModal);
  }

  const replayPanel = document.querySelector("replay-panel") as ReplayPanel;
  if (replayPanel) {
    replayPanel.eventBus = eventBus;
    replayPanel.game = game;
    uiLayers.push(replayPanel);
  }

  const gameRightSidebar = document.querySelector(
    "game-right-sidebar"
  ) as GameRightSidebar;
  if (gameRightSidebar) {
    gameRightSidebar.game = game;
    gameRightSidebar.eventBus = eventBus;
    uiLayers.push(gameRightSidebar);
  }

  const settingsModal = document.querySelector(
    "settings-modal"
  ) as SettingsModal;
  if (settingsModal) {
    settingsModal.userSettings = userSettings;
    settingsModal.eventBus = eventBus;
    uiLayers.push(settingsModal);
  }

  const unitDisplay = document.querySelector("unit-display") as UnitDisplay;
  if (unitDisplay) {
    unitDisplay.game = game;
    unitDisplay.eventBus = eventBus;
    unitDisplay.uiState = renderer.uiState;
    uiLayers.push(unitDisplay);
  }

  const playerPanel = document.querySelector("player-panel") as PlayerPanel;
  if (playerPanel) {
    playerPanel.g = game;
    playerPanel.initEventBus(eventBus);
    if (emojiTable) {
      playerPanel.emojiTable = emojiTable;
    }
    playerPanel.uiState = renderer.uiState;
    uiLayers.push(playerPanel);
  }

  const chatModal = document.querySelector("chat-modal") as ChatModal;
  if (chatModal) {
    chatModal.g = game;
    chatModal.initEventBus(eventBus);
  }

  const multiTabModal = document.querySelector(
    "multi-tab-modal"
  ) as MultiTabModal;
  if (multiTabModal) {
    multiTabModal.game = game;
    uiLayers.push(multiTabModal);
  }

  const headsUpMessage = document.querySelector(
    "heads-up-message"
  ) as HeadsUpMessage;
  if (headsUpMessage) {
    headsUpMessage.game = game;
    uiLayers.push(headsUpMessage);
  }

  const performanceOverlay = document.querySelector(
    "performance-overlay"
  ) as PerformanceOverlay;
  if (performanceOverlay) {
    performanceOverlay.eventBus = eventBus;
    performanceOverlay.userSettings = userSettings;
    uiLayers.push(performanceOverlay);
  }

  const alertFrame = document.querySelector("alert-frame") as AlertFrame;
  if (alertFrame) {
    alertFrame.game = game;
    uiLayers.push(alertFrame);
  }

  const spawnTimer = document.querySelector("spawn-timer") as SpawnTimer;
  if (spawnTimer) {
    spawnTimer.game = game;
    spawnTimer.transformHandler = renderer.transformHandler as never;
    uiLayers.push(spawnTimer);
  }

  const immunityTimer = document.querySelector(
    "immunity-timer"
  ) as ImmunityTimer;
  if (immunityTimer) {
    immunityTimer.game = game;
    uiLayers.push(immunityTimer);
  }

  // Create the radial menu
  if (buildMenu && emojiTable && playerPanel) {
    const radialMenu = new MainRadialMenu(
      eventBus,
      game,
      renderer.transformHandler as never,
      emojiTable,
      buildMenu,
      renderer.uiState,
      playerPanel
    );
    uiLayers.push(radialMenu);
  }

  // Set UI layers on the renderer so they get initialized and ticked
  renderer.setUILayers(uiLayers);

  console.log("create3DRenderer: Complete");
  return { renderer, inputHandler };
}
