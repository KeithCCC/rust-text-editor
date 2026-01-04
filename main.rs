use eframe::egui;
use std::fs;
use std::path::PathBuf;

fn main() -> Result<(), eframe::Error> {
    let options = eframe::NativeOptions {
        viewport: egui::ViewportBuilder::default()
            .with_inner_size([1200.0, 800.0])
            .with_maximized(true)
            .with_title("Rust Text Editor"),
        ..Default::default()
    };
    
    eframe::run_native(
        "Rust Text Editor",
        options,
        Box::new(|_cc| Ok(Box::new(TextEditorApp::default()))),
    )
}

#[derive(Default)]
struct TextEditorApp {
    content: String,
    current_file: Option<PathBuf>,
    modified: bool,
}

impl eframe::App for TextEditorApp {
    fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
        // Menu bar
        egui::TopBottomPanel::top("menu_bar").show(ctx, |ui| {
            egui::menu::bar(ui, |ui| {
                ui.menu_button("File", |ui| {
                    if ui.button("New").clicked() {
                        self.new_file();
                        ui.close_menu();
                    }
                    if ui.button("Open...").clicked() {
                        self.open_file();
                        ui.close_menu();
                    }
                    if ui.button("Save").clicked() {
                        self.save_file();
                        ui.close_menu();
                    }
                    if ui.button("Save As...").clicked() {
                        self.save_file_as();
                        ui.close_menu();
                    }
                    ui.separator();
                    if ui.button("Exit").clicked() {
                        ctx.send_viewport_cmd(egui::ViewportCommand::Close);
                    }
                });
                
                ui.menu_button("Edit", |ui| {
                    if ui.button("Clear").clicked() {
                        self.content.clear();
                        self.modified = true;
                        ui.close_menu();
                    }
                });
            });
        });

        // Status bar
        egui::TopBottomPanel::bottom("status_bar").show(ctx, |ui| {
            ui.horizontal(|ui| {
                if let Some(path) = &self.current_file {
                    ui.label(format!("File: {}", path.display()));
                } else {
                    ui.label("File: Untitled");
                }
                
                ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                    if self.modified {
                        ui.label("Modified");
                    } else {
                        ui.label("Saved");
                    }
                    ui.label(format!("Lines: {}", self.content.lines().count()));
                    ui.label(format!("Chars: {}", self.content.len()));
                });
            });
        });

        // Main text editor
        egui::CentralPanel::default().show(ctx, |ui| {
            let text_edit = egui::TextEdit::multiline(&mut self.content)
                .font(egui::TextStyle::Monospace)
                .code_editor()
                .desired_width(f32::INFINITY);
            
            let response = ui.add_sized(ui.available_size(), text_edit);
            if response.changed() {
                self.modified = true;
            }
        });
    }
}

impl TextEditorApp {
    fn new_file(&mut self) {
        if self.modified {
            // In a real app, you'd ask the user to save first
        }
        self.content.clear();
        self.current_file = None;
        self.modified = false;
    }

    fn open_file(&mut self) {
        if let Some(path) = rfd::FileDialog::new()
            .add_filter("Text Files", &["txt", "rs", "toml", "md"])
            .add_filter("All Files", &["*"])
            .pick_file()
        {
            match fs::read_to_string(&path) {
                Ok(content) => {
                    self.content = content;
                    self.current_file = Some(path);
                    self.modified = false;
                }
                Err(e) => {
                    eprintln!("Error opening file: {}", e);
                }
            }
        }
    }

    fn save_file(&mut self) {
        if let Some(path) = &self.current_file {
            match fs::write(path, &self.content) {
                Ok(_) => {
                    self.modified = false;
                }
                Err(e) => {
                    eprintln!("Error saving file: {}", e);
                }
            }
        } else {
            self.save_file_as();
        }
    }

    fn save_file_as(&mut self) {
        if let Some(path) = rfd::FileDialog::new()
            .add_filter("Text Files", &["txt"])
            .add_filter("Rust Files", &["rs"])
            .add_filter("All Files", &["*"])
            .save_file()
        {
            match fs::write(&path, &self.content) {
                Ok(_) => {
                    self.current_file = Some(path);
                    self.modified = false;
                }
                Err(e) => {
                    eprintln!("Error saving file: {}", e);
                }
            }
        }
    }
}
