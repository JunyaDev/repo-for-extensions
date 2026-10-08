# Flutter web test app

Registration form (text fields with labels only, dropdown, radios, checkbox, password, multi-line notes) used to test
Form Filler on Flutter web. The values the Flutter framework actually holds are published to
`globalThis.__flutterFormState`, so a test can tell "the DOM shows it" apart from "the app received it".

```bash
flutter create --platforms web --project-name ffapp .   # once, generates web/ etc.
flutter build web --release
python3 -m http.server 8080 --directory build/web
```

Open http://localhost:8080, press Alt+Shift+F, then check in the DevTools console:
`JSON.parse(__flutterFormState)`.
