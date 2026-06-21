import type { RefObject } from "react";
import type { Backlink, VaultFile, VaultSearchMatch } from "../tauri";

type VaultSort = "modified" | "name" | "size";
type VaultSearchMode = "files" | "contents";

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
  isCollapsed: boolean;
  isLoading: boolean;
  isContentSearching: boolean;
  onFilterChange: (value: string) => void;
  onClearFilter: () => void;
  onSearchModeChange: (value: VaultSearchMode) => void;
  onSortChange: (value: VaultSort) => void;
  onToggleCollapsed: () => void;
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

export type { VaultSearchMode, VaultSort };

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
  isCollapsed,
  isLoading,
  isContentSearching,
  onFilterChange,
  onClearFilter,
  onSearchModeChange,
  onSortChange,
  onToggleCollapsed,
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
    return (
      <aside className="vault-sidebar collapsed" aria-label="Vault">
        <button type="button" onClick={onToggleCollapsed} title="Show Vault (Ctrl+\\)">
          Vault
        </button>
      </aside>
    );
  }

  return (
    <aside className="vault-sidebar" aria-label="Vault files">
      <header className="vault-sidebar-header">
        <div>
          <strong>Vault</strong>
          <span title={vaultPath ?? "No vault selected"}>{vaultPath ?? "No vault selected"}</span>
        </div>
        <button type="button" onClick={onToggleCollapsed} title="Hide Vault (Ctrl+\\)" aria-label="Hide Vault">
          Hide
        </button>
      </header>

      <div className="vault-actions">
        <button type="button" onClick={onNewNote}>New</button>
        <button type="button" onClick={onRefresh} disabled={!vaultPath || isLoading}>
          {isLoading ? "Refreshing" : "Refresh"}
        </button>
        <select value={sort} onChange={(event) => onSortChange(event.target.value as VaultSort)} aria-label="Sort vault files" title="Sort vault files">
          <option value="modified">Modified</option>
          <option value="name">Name</option>
          <option value="size">Size</option>
        </select>
      </div>

      <div className="vault-controls">
        <input
          ref={filterInputRef}
          type="search"
          value={filter}
          onChange={(event) => onFilterChange(event.target.value)}
          placeholder={searchMode === "contents" ? "Search note text" : "Filter files or #tags"}
          aria-label={searchMode === "contents" ? "Search vault note contents" : "Filter vault files"}
        />
        <button
          type="button"
          className="vault-search-mode"
          onClick={() => onSearchModeChange(searchMode === "contents" ? "files" : "contents")}
          aria-pressed={searchMode === "contents"}
          title={searchMode === "contents" ? "Search file names and tags" : "Search inside Markdown files"}
        >
          {searchMode === "contents" ? "Text" : "Files"}
        </button>
        <button type="button" className="vault-clear-search" onClick={onClearFilter} disabled={!filter && searchMode === "files"} title="Clear search">
          Clear
        </button>
      </div>

      <div className="vault-file-list" role="listbox" aria-label="Vault files">
        {searchMode === "contents" && filter.trim() ? (
          <>
            {isContentSearching && <div className="vault-empty">Searching note text...</div>}
            {!isContentSearching && contentResults.length === 0 && <div className="vault-empty">{vaultPath ? "No text matches" : "Choose a vault to begin"}</div>}
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
                      Line {result.lineNumber}: {before}<mark>{match}</mark>{after}
                    </small>
                  </button>
                </article>
              );
            })}
          </>
        ) : (
          <>
            {files.length === 0 && <div className="vault-empty">{vaultPath ? "No matching files" : "Choose a vault to begin"}</div>}
            {files.map((file) => {
          const isActive = currentFile === file.path;

          return (
            <article className="vault-file-row" data-active={isActive} key={file.path}>
              <button type="button" className="vault-file-main" onClick={() => onOpenFile(file.path)} title={file.relativePath}>
                <span>{file.name}</span>
              </button>
              <details className="vault-file-menu">
                <summary aria-label={`Actions for ${file.name}`} title="File actions">...</summary>
                <div className="vault-file-menu-popover" role="menu">
                  <button type="button" role="menuitem" onClick={() => onOpenFile(file.path)}>Open</button>
                  <button type="button" role="menuitem" onClick={() => onOpenInNewInstance(file.path)}>Open in New Instance</button>
                  <button type="button" role="menuitem" onClick={() => onRenameFile(file)}>Rename</button>
                  <button type="button" role="menuitem" onClick={() => onDuplicateFile(file)}>Duplicate</button>
                  <button type="button" role="menuitem" onClick={() => onDeleteFile(file)}>Delete</button>
                </div>
              </details>
            </article>
          );
            })}
          </>
        )}
      </div>

      <section className="backlinks-panel" aria-label="Backlinks">
        {currentTags.length > 0 && (
          <div className="current-tags" aria-label="Current note tags">
            {currentTags.map((tag) => (
              <button key={tag} type="button" onClick={() => onTagClick(tag)} title={`Filter by #${tag}`}>
                #{tag}
              </button>
            ))}
          </div>
        )}
        <header>
          <strong>Backlinks</strong>
          <span>{backlinks.length}</span>
        </header>
        {backlinks.length === 0 && <div className="vault-empty">No linked mentions</div>}
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
