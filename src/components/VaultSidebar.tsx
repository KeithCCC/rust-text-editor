import type { RefObject } from "react";
import type { Backlink, VaultFile, VaultSearchMatch } from "../tauri";

type VaultSort = "modified" | "name" | "size";
type VaultSearchMode = "files" | "contents";

type VaultSidebarLabels = {
  vault: string;
  noVaultSelected: string;
  newNote: string;
  refresh: string;
  refreshing: string;
  modified: string;
  name: string;
  size: string;
  searchNoteText: string;
  filterFiles: string;
  files: string;
  text: string;
  clear: string;
  searchingNoteText: string;
  noTextMatches: string;
  chooseVault: string;
  noMatchingFiles: string;
  line: string;
  open: string;
  openInNewInstance: string;
  rename: string;
  duplicate: string;
  delete: string;
  fileActions: string;
  currentNoteTags: string;
  filterByTag: string;
  backlinks: string;
  noLinkedMentions: string;
};

type VaultSidebarProps = {
  vaultPath: string | null;
  files: VaultFile[];
  contentResults: VaultSearchMatch[];
  backlinks: Backlink[];
  currentFile: string | null;
  currentTags: string[];
  filter: string;
  filterInputRef?: RefObject<HTMLInputElement>;
  searchMode: VaultSearchMode;
  sort: VaultSort;
  labels: VaultSidebarLabels;
  isCollapsed: boolean;
  isLoading: boolean;
  isContentSearching: boolean;
  onFilterChange: (value: string) => void;
  onClearFilter: () => void;
  onSearchModeChange: (value: VaultSearchMode) => void;
  onSortChange: (value: VaultSort) => void;
  onRefresh: () => void;
  onNewNote: () => void;
  onOpenFile: (path: string) => void;
  onOpenSearchResult: (result: VaultSearchMatch) => void;
  onOpenInNewInstance: (path: string) => void;
  onRenameFile: (file: VaultFile) => void;
  onDuplicateFile: (file: VaultFile) => void;
  onDeleteFile: (file: VaultFile) => void;
  onOpenBacklink: (path: string) => void;
  onTagClick: (tag: string) => void;
};

export type { VaultSearchMode, VaultSort, VaultSidebarLabels };

export function VaultSidebar({
  vaultPath,
  files,
  contentResults,
  backlinks,
  currentFile,
  currentTags,
  filter,
  filterInputRef,
  searchMode,
  sort,
  labels,
  isCollapsed,
  isLoading,
  isContentSearching,
  onFilterChange,
  onClearFilter,
  onSearchModeChange,
  onSortChange,
  onRefresh,
  onNewNote,
  onOpenFile,
  onOpenSearchResult,
  onOpenInNewInstance,
  onRenameFile,
  onDuplicateFile,
  onDeleteFile,
  onOpenBacklink,
  onTagClick,
}: VaultSidebarProps) {
  if (isCollapsed) {
    return null;
  }

  return (
    <aside className="vault-sidebar" aria-label="Vault files">
      <header className="vault-sidebar-header">
        <div>
          <strong>{labels.vault}</strong>
          <span title={vaultPath ?? labels.noVaultSelected}>{vaultPath ?? labels.noVaultSelected}</span>
        </div>
      </header>

      <div className="vault-actions">
        <button type="button" onClick={onNewNote}>{labels.newNote}</button>
        <button type="button" onClick={onRefresh} disabled={!vaultPath || isLoading}>
          {isLoading ? labels.refreshing : labels.refresh}
        </button>
        <select value={sort} onChange={(event) => onSortChange(event.target.value as VaultSort)} aria-label="Sort vault files" title="Sort vault files">
          <option value="modified">{labels.modified}</option>
          <option value="name">{labels.name}</option>
          <option value="size">{labels.size}</option>
        </select>
      </div>

      <div className="vault-controls">
        <input
          ref={filterInputRef}
          type="search"
          value={filter}
          onChange={(event) => onFilterChange(event.target.value)}
          placeholder={searchMode === "contents" ? labels.searchNoteText : labels.filterFiles}
          aria-label={searchMode === "contents" ? labels.searchNoteText : labels.filterFiles}
        />
        <button
          type="button"
          className="vault-search-mode"
          onClick={() => onSearchModeChange(searchMode === "contents" ? "files" : "contents")}
          aria-pressed={searchMode === "contents"}
          title={searchMode === "contents" ? labels.filterFiles : labels.searchNoteText}
        >
          {searchMode === "contents" ? labels.text : labels.files}
        </button>
        <button type="button" className="vault-clear-search" onClick={onClearFilter} disabled={!filter && searchMode === "files"} title={labels.clear}>
          {labels.clear}
        </button>
      </div>

      <div className="vault-file-list" role="listbox" aria-label={labels.vault}>
        {searchMode === "contents" && filter.trim() ? (
          <>
            {isContentSearching && <div className="vault-empty">{labels.searchingNoteText}</div>}
            {!isContentSearching && contentResults.length === 0 && <div className="vault-empty">{vaultPath ? labels.noTextMatches : labels.chooseVault}</div>}
            {contentResults.map((result, index) => {
              const isActive = currentFile === result.path;
              const before = result.lineText.slice(0, result.lineMatchStart);
              const match = result.lineText.slice(result.lineMatchStart, result.lineMatchEnd);
              const after = result.lineText.slice(result.lineMatchEnd);

              return (
                <article className="vault-file-row vault-search-row" data-active={isActive} key={`${result.path}:${result.lineNumber}:${result.matchStart}:${index}`}>
                  <button type="button" className="vault-file-main vault-search-main" onClick={() => onOpenSearchResult(result)} title={`${result.relativePath}:${result.lineNumber}`}>
                    <span>{result.name}</span>
                    <small>
                      {labels.line} {result.lineNumber}: {before}<mark>{match}</mark>{after}
                    </small>
                  </button>
                </article>
              );
            })}
          </>
        ) : (
          <>
            {files.length === 0 && <div className="vault-empty">{vaultPath ? labels.noMatchingFiles : labels.chooseVault}</div>}
            {files.map((file) => {
          const isActive = currentFile === file.path;

          return (
            <article className="vault-file-row" data-active={isActive} key={file.path}>
              <button type="button" className="vault-file-main" onClick={() => onOpenFile(file.path)} title={file.relativePath}>
                <span>{file.name}</span>
              </button>
              <details className="vault-file-menu">
                <summary aria-label={`${labels.fileActions}: ${file.name}`} title={labels.fileActions}>...</summary>
                <div className="vault-file-menu-popover" role="menu">
                  <button type="button" role="menuitem" onClick={() => onOpenFile(file.path)}>{labels.open}</button>
                  <button type="button" role="menuitem" onClick={() => onOpenInNewInstance(file.path)}>{labels.openInNewInstance}</button>
                  <button type="button" role="menuitem" onClick={() => onRenameFile(file)}>{labels.rename}</button>
                  <button type="button" role="menuitem" onClick={() => onDuplicateFile(file)}>{labels.duplicate}</button>
                  <button type="button" role="menuitem" onClick={() => onDeleteFile(file)}>{labels.delete}</button>
                </div>
              </details>
            </article>
          );
            })}
          </>
        )}
      </div>

      <section className="backlinks-panel" aria-label={labels.backlinks}>
        {currentTags.length > 0 && (
          <div className="current-tags" aria-label={labels.currentNoteTags}>
            {currentTags.map((tag) => (
              <button key={tag} type="button" onClick={() => onTagClick(tag)} title={`${labels.filterByTag} #${tag}`}>
                #{tag}
              </button>
            ))}
          </div>
        )}
        <header>
          <strong>{labels.backlinks}</strong>
          <span>{backlinks.length}</span>
        </header>
        {backlinks.length === 0 && <div className="vault-empty">{labels.noLinkedMentions}</div>}
        {backlinks.map((backlink) => (
          <button key={backlink.path} type="button" onClick={() => onOpenBacklink(backlink.path)} title={backlink.path}>
            <span>{backlink.relativePath}</span>
            <small>{backlink.matches.map((match) => `[[${match}]]`).join(", ")}</small>
          </button>
        ))}
      </section>
    </aside>
  );
}
