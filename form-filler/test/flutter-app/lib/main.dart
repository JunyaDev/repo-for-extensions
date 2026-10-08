// Flutter web test app for Form Filler: a typical registration form (labels only, no autofill hints).
// The values the framework actually holds are published to globalThis.__flutterFormState for verification.
import 'dart:convert';
import 'dart:js_interop';

import 'package:flutter/material.dart';

@JS('__flutterFormState')
external set flutterFormState(JSString value);

void main() => runApp(const MaterialApp(title: 'Flutter form test', home: FormPage()));

class FormPage extends StatefulWidget {
  const FormPage({super.key});

  @override
  State<FormPage> createState() => _FormPageState();
}

class _FormPageState extends State<FormPage> {
  final Map<String, TextEditingController> _c = {
    for (final k in ['nome', 'cognome', 'email', 'telefono', 'cf', 'iban', 'password', 'note']) k: TextEditingController(),
  };
  bool privacy = false;
  String? sesso;
  String? provincia;

  void _publish() {
    flutterFormState = jsonEncode({
      for (final e in _c.entries) e.key: e.value.text,
      'privacy': privacy,
      'sesso': sesso,
      'provincia': provincia,
    }).toJS;
  }

  @override
  void initState() {
    super.initState();
    for (final c in _c.values) {
      c.addListener(_publish);
    }
    _publish();
  }

  Widget _field(String key, String label, {bool obscure = false, int maxLines = 1, TextInputType? type}) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: TextFormField(
          controller: _c[key],
          obscureText: obscure,
          maxLines: maxLines,
          keyboardType: type,
          decoration: InputDecoration(labelText: label, border: const OutlineInputBorder()),
        ),
      );

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Registrazione')),
        body: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(children: [
            _field('nome', 'Nome'),
            _field('cognome', 'Cognome'),
            _field('email', 'Email', type: TextInputType.emailAddress),
            _field('telefono', 'Telefono', type: TextInputType.phone),
            _field('cf', 'Codice fiscale'),
            _field('iban', 'IBAN'),
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 6),
              child: DropdownButtonFormField<String>(
                decoration: const InputDecoration(labelText: 'Provincia', border: OutlineInputBorder()),
                items: const ['MI', 'RM', 'TO', 'NA'].map((v) => DropdownMenuItem(value: v, child: Text(v))).toList(),
                onChanged: (v) => setState(() {
                  provincia = v;
                  _publish();
                }),
              ),
            ),
            const Align(alignment: Alignment.centerLeft, child: Text('Sesso')),
            for (final (value, label) in const [('M', 'Maschio'), ('F', 'Femmina')])
              // ignore: deprecated_member_use
              RadioListTile<String>(
                title: Text(label),
                value: value,
                // ignore: deprecated_member_use
                groupValue: sesso,
                // ignore: deprecated_member_use
                onChanged: (v) => setState(() {
                  sesso = v;
                  _publish();
                }),
              ),
            CheckboxListTile(
              title: const Text("Ho letto l'informativa privacy e acconsento"),
              value: privacy,
              onChanged: (v) => setState(() {
                privacy = v ?? false;
                _publish();
              }),
            ),
            _field('password', 'Password', obscure: true),
            _field('note', 'Note', maxLines: 3),
            ElevatedButton(onPressed: () {}, child: const Text('Invia')),
          ]),
        ),
      );
}
