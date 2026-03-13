'use strict';

const vscode = require('vscode');

function tokeniser(code) {
    const tokens = [];
    let i = 0;
    while (i < code.length) {
        if (/\s/.test(code[i])) { i++; continue; }
        if (code[i] === '#') { while (i < code.length && code[i] !== '\n') i++; continue; }
        if (code[i] === '"') {
            let s = ''; i++;
            while (i < code.length && code[i] !== '"') {
                if (code[i] === '\\' && code[i + 1] === '"') { s += '"'; i += 2; }
                else s += code[i++];
            }
            i++;
            tokens.push({ type: 'CHAINE', val: s });
            continue;
        }
        if (/[0-9]/.test(code[i])) {
            let n = '';
            while (i < code.length && /[0-9.]/.test(code[i])) n += code[i++];
            tokens.push({ type: 'NOMBRE', val: parseFloat(n) });
            continue;
        }
        const deux = code.slice(i, i + 2);
        if (['<=', '>=', '!=', '≠', '≤', '≥'].includes(deux)) { tokens.push({ type: 'OP', val: deux }); i += 2; continue; }
        if ('+-*/%<>='.includes(code[i])) { tokens.push({ type: 'OP', val: code[i++] }); continue; }
        if (code[i] === '[') { tokens.push({ type: 'CROCHET_O', val: '[' }); i++; continue; }
        if (code[i] === ']') { tokens.push({ type: 'CROCHET_F', val: ']' }); i++; continue; }
        if (code[i] === '(') { tokens.push({ type: 'PAREN_O', val: '(' }); i++; continue; }
        if (code[i] === ')') { tokens.push({ type: 'PAREN_F', val: ')' }); i++; continue; }
        if (code[i] === ',') { tokens.push({ type: 'VIRGULE', val: ',' }); i++; continue; }
        if (/[a-zA-ZÀ-ÿ_]/.test(code[i])) {
            let id = '';
            while (i < code.length && /[a-zA-ZÀ-ÿ0-9_]/.test(code[i])) id += code[i++];
            tokens.push({ type: 'ID', val: id });
            continue;
        }
        i++;
    }
    return tokens;
}

class Interpreteur {
    constructor() {
        this.sortie = [];
        this.env = [{}];
        this.fonctions = {};
        this.appels = 0;
    }

    ecrire(msg) { this.sortie.push(String(msg)); }

    portee() { return this.env[this.env.length - 1]; }

    obtenirVar(nom) {
        for (let i = this.env.length - 1; i >= 0; i--) {
            if (nom in this.env[i]) return this.env[i][nom];
        }
        throw new Error(`Variable inconnue : "${nom}"`);
    }

    definirVar(nom, val) {
        for (let i = this.env.length - 1; i >= 0; i--) {
            if (nom in this.env[i]) { this.env[i][nom] = val; return; }
        }
        this.portee()[nom] = val;
    }

    interpreter(code) {
        const lignes = code.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
        this.executerBloc(lignes, 0, lignes.length);
    }

    executerBloc(lignes, debut, fin) {
        let i = debut;
        while (i < fin) {
            const res = this.executerLigne(lignes, i, fin);
            if (res && res.retour !== undefined) return res;
            i = (res && res.i !== undefined) ? res.i : i + 1;
        }
        return null;
    }

    executerLigne(lignes, i, fin) {
        const ligne = lignes[i];
        if (!ligne) return { i: i + 1 };
        const tokens = tokeniser(ligne);
        if (!tokens.length) return { i: i + 1 };
        const mot1 = tokens[0]?.val;

        if (mot1 === 'afficher') {
            const val = this.evaluerExpr(tokens.slice(1));
            this.ecrire(this.formater(val));
            return { i: i + 1 };
        }
        if (mot1 === 'variable') {
            const nom = tokens[1]?.val;
            const idx = tokens.findIndex(t => t.type === 'OP' && t.val === '=');
            if (idx !== -1) this.definirVar(nom, this.evaluerExpr(tokens.slice(idx + 1)));
            return { i: i + 1 };
        }
        if (mot1 === 'liste') {
            const nom = tokens[1]?.val;
            const idx = tokens.findIndex(t => t.type === 'OP' && t.val === '=');
            if (idx !== -1) this.definirVar(nom, this.evaluerExpr(tokens.slice(idx + 1)));
            return { i: i + 1 };
        }
        if (mot1 === 'ajouter') {
            const aIdx = tokens.findIndex(t => t.type === 'ID' && t.val === 'à');
            if (aIdx !== -1) {
                const val = this.evaluerExpr(tokens.slice(1, aIdx));
                const nom = tokens[aIdx + 1]?.val;
                const liste = this.obtenirVar(nom);
                if (Array.isArray(liste)) liste.push(val);
            }
            return { i: i + 1 };
        }
        if (mot1 === 'si') return this.gererSi(lignes, i, fin);
        if (mot1 === 'tant' && tokens[1]?.val === 'que') return this.gererTantQue(lignes, i, fin);
        if (mot1 === 'répéter') return this.gererRepeter(lignes, i, fin);
        if (mot1 === 'fonction') return this.gererDefFonction(lignes, i, fin);
        if (mot1 === 'retourner') {
            const val = tokens.length > 1 ? this.evaluerExpr(tokens.slice(1)) : null;
            return { retour: val, i: i + 1 };
        }
        if (mot1 === 'fin') return { fin: true, i: i + 1 };
        if (tokens[0]?.type === 'ID' && tokens[1]?.type === 'PAREN_O') { this.evaluerExpr(tokens); return { i: i + 1 }; }
        if (tokens[0]?.type === 'ID' && tokens[1]?.type === 'OP' && tokens[1]?.val === '=') {
            this.definirVar(tokens[0].val, this.evaluerExpr(tokens.slice(2)));
            return { i: i + 1 };
        }
        return { i: i + 1 };
    }

    gererSi(lignes, i, fin) {
        const tokens = tokeniser(lignes[i]);
        let condTokens = this.extraireCond(tokens, 'si', 'alors');
        const blocs = [];
        let corpsStart = i + 1, j = i + 1, profondeur = 1;

        while (j < fin) {
            const t = tokeniser(lignes[j]);
            if (!t.length) { j++; continue; }
            if (['si', 'répéter', 'fonction'].includes(t[0]?.val) || (t[0]?.val === 'tant' && t[1]?.val === 'que')) profondeur++;
            if (t[0]?.val === 'fin' && profondeur === 1) {
                blocs.push({ condition: condTokens, debut: corpsStart, fin: j });
                return this.executerBlocs(blocs, lignes, j + 1);
            }
            if (t[0]?.val === 'sinon' && profondeur === 1) {
                blocs.push({ condition: condTokens, debut: corpsStart, fin: j });
                corpsStart = j + 1;
                condTokens = (t[1]?.val === 'si') ? this.extraireCond(t.slice(1), 'si', 'alors') : null;
            }
            if (t[0]?.val === 'fin') profondeur--;
            j++;
        }
        return { i: j };
    }

    extraireCond(tokens, motDebut, motFin) {
        let d = 0; while (d < tokens.length && tokens[d]?.val === motDebut) d++;
        let f = tokens.length - 1; while (f >= 0 && tokens[f]?.val === motFin) f--;
        return tokens.slice(d, f + 1);
    }

    executerBlocs(blocs, lignes, iApres) {
        for (const bloc of blocs) {
            const cond = bloc.condition === null ? true : this.evaluerExpr(bloc.condition);
            if (cond === true || cond === 'vrai') {
                this.env.push({});
                const res = this.executerBloc(lignes, bloc.debut, bloc.fin);
                this.env.pop();
                if (res && res.retour !== undefined) return res;
                return { i: iApres };
            }
        }
        return { i: iApres };
    }

    gererTantQue(lignes, i, fin) {
        const tokens = tokeniser(lignes[i]);
        const condTokens = this.extraireCond(tokens, 'tant', 'faire').filter(t => t.val !== 'que');
        const corpsStart = i + 1;
        let j = i + 1, profondeur = 1;
        while (j < fin) {
            const t = tokeniser(lignes[j]);
            if (!t.length) { j++; continue; }
            if (['si', 'répéter', 'fonction'].includes(t[0]?.val) || (t[0]?.val === 'tant' && t[1]?.val === 'que')) profondeur++;
            if (t[0]?.val === 'fin') { profondeur--; if (profondeur === 0) break; }
            j++;
        }
        let iterations = 0;
        while (true) {
            if (++iterations > 10000) { this.ecrire('⚠ Boucle infinie détectée (> 10 000 itérations)'); break; }
            const cond = this.evaluerExpr(condTokens);
            if (cond !== true && cond !== 'vrai') break;
            this.env.push({});
            const res = this.executerBloc(lignes, corpsStart, j);
            this.env.pop();
            if (res && res.retour !== undefined) return res;
        }
        return { i: j + 1 };
    }

    gererRepeter(lignes, i, fin) {
        const tokens = tokeniser(lignes[i]);
        const n = this.evaluerExpr([tokens[1]]);
        const corpsStart = i + 1;
        let j = i + 1, profondeur = 1;
        while (j < fin) {
            const t = tokeniser(lignes[j]);
            if (!t.length) { j++; continue; }
            if (['si', 'répéter', 'fonction'].includes(t[0]?.val) || (t[0]?.val === 'tant' && t[1]?.val === 'que')) profondeur++;
            if (t[0]?.val === 'fin') { profondeur--; if (profondeur === 0) break; }
            j++;
        }
        for (let k = 0; k < n; k++) {
            this.env.push({});
            const res = this.executerBloc(lignes, corpsStart, j);
            this.env.pop();
            if (res && res.retour !== undefined) return res;
        }
        return { i: j + 1 };
    }

    gererDefFonction(lignes, i, fin) {
        const tokens = tokeniser(lignes[i]);
        const nom = tokens[1]?.val;
        const pO = tokens.findIndex(t => t.type === 'PAREN_O');
        const pF = tokens.findIndex(t => t.type === 'PAREN_F');
        const params = [];
        if (pO !== -1 && pF !== -1) for (let k = pO + 1; k < pF; k++) { if (tokens[k]?.type === 'ID') params.push(tokens[k].val); }
        const corpsStart = i + 1;
        let j = i + 1, profondeur = 1;
        while (j < fin) {
            const t = tokeniser(lignes[j]);
            if (!t.length) { j++; continue; }
            if (['si', 'répéter', 'fonction'].includes(t[0]?.val) || (t[0]?.val === 'tant' && t[1]?.val === 'que')) profondeur++;
            if (t[0]?.val === 'fin') { profondeur--; if (profondeur === 0) break; }
            j++;
        }
        this.fonctions[nom] = { params, corps: lignes.slice(corpsStart, j) };
        return { i: j + 1 };
    }

    appelerFonction(nom, args) {
        if (nom === 'afficher') { this.ecrire(this.formater(args[0])); return null; }
        if (nom === 'texte') return String(args[0] ?? '');
        if (nom === 'nombre') return parseFloat(args[0]) || 0;
        if (nom === 'longueur') return Array.isArray(args[0]) ? args[0].length : String(args[0]).length;
        if (nom === 'hasard') { const min = Math.ceil(args[0] ?? 0), max = Math.floor(args[1] ?? 100); return Math.floor(Math.random() * (max - min + 1)) + min; }
        if (nom === 'arrondi') return Math.round(args[0] ?? 0);
        if (nom === 'plancher') return Math.floor(args[0] ?? 0);
        if (nom === 'plafond') return Math.ceil(args[0] ?? 0);
        if (nom === 'absolu' || nom === 'abs') return Math.abs(args[0] ?? 0);
        if (nom === 'racine') return Math.sqrt(args[0] ?? 0);
        if (nom === 'majuscules') return String(args[0]).toUpperCase();
        if (nom === 'minuscules') return String(args[0]).toLowerCase();
        if (nom === 'inverser') return Array.isArray(args[0]) ? [...args[0]].reverse() : String(args[0]).split('').reverse().join('');
        if (nom === 'contient') return Array.isArray(args[0]) ? args[0].includes(args[1]) : String(args[0]).includes(String(args[1]));
        if (!(nom in this.fonctions)) throw new Error(`Fonction inconnue : "${nom}"`);
        if (++this.appels > 5000) throw new Error('Trop de récursion');
        const fn = this.fonctions[nom];
        this.env.push({});
        fn.params.forEach((p, k) => { this.portee()[p] = args[k] ?? null; });
        const res = this.executerBloc(fn.corps, 0, fn.corps.length);
        this.env.pop();
        this.appels--;
        return res?.retour ?? null;
    }

    evaluerExpr(tokens) {
        if (!tokens || !tokens.length) return null;
        while (tokens.length >= 2 && tokens[0]?.type === 'PAREN_O' && tokens[tokens.length - 1]?.type === 'PAREN_F') {
            let p = 0, wrap = true;
            for (let i = 0; i < tokens.length - 1; i++) {
                if (tokens[i]?.type === 'PAREN_O') p++;
                if (tokens[i]?.type === 'PAREN_F') p--;
                if (p === 0) { wrap = false; break; }
            }
            if (wrap) tokens = tokens.slice(1, -1); else break;
        }
        if (!tokens.length) return null;
        if (tokens.length === 1) {
            const t = tokens[0];
            if (t.type === 'NOMBRE') return t.val;
            if (t.type === 'CHAINE') return t.val;
            if (t.type === 'ID') {
                if (t.val === 'vrai') return true;
                if (t.val === 'faux') return false;
                if (t.val === 'nul') return null;
                return this.obtenirVar(t.val);
            }
        }
        if (tokens[0]?.val === 'non') return !(this.evaluerExpr(tokens.slice(1)) === true);
        if (tokens.length >= 4 && tokens[0]?.type === 'ID' && tokens[1]?.type === 'CROCHET_O') {
            const fIdx = tokens.findIndex(t => t.type === 'CROCHET_F');
            const liste = this.obtenirVar(tokens[0].val);
            return Array.isArray(liste) ? (liste[this.evaluerExpr(tokens.slice(2, fIdx))] ?? null) : null;
        }
        if (tokens[0]?.type === 'CROCHET_O') {
            const fIdx = tokens.findIndex(t => t.type === 'CROCHET_F');
            const inner = tokens.slice(1, fIdx);
            return !inner.length ? [] : this.separerVirgules(inner).map(t => this.evaluerExpr(t));
        }
        if (tokens[0]?.type === 'ID' && tokens[1]?.type === 'PAREN_O') {
            const nom = tokens[0].val;
            const fIdx = tokens.findIndex(t => t.type === 'PAREN_F');
            const inner = tokens.slice(2, fIdx);
            const args = inner.length ? this.separerVirgules(inner).map(t => this.evaluerExpr(t)) : [];
            return this.appelerFonction(nom, args);
        }
        for (const ops of [['ou'], ['et'], ['=', '!=', '≠', '<', '>', '<=', '>=', '≤', '≥'], ['+', '-'], ['*', '/', '%']]) {
            let profondeur = 0;
            for (let k = tokens.length - 1; k >= 0; k--) {
                const t = tokens[k];
                if (t.type === 'PAREN_F' || t.type === 'CROCHET_F') profondeur++;
                if (t.type === 'PAREN_O' || t.type === 'CROCHET_O') profondeur--;
                if (profondeur === 0 && ((t.type === 'OP' && ops.includes(t.val)) || (t.type === 'ID' && ops.includes(t.val)))) {
                    return this.appliquerOp(t.val, this.evaluerExpr(tokens.slice(0, k)), this.evaluerExpr(tokens.slice(k + 1)));
                }
            }
        }
        return null;
    }

    separerVirgules(tokens) {
        const groupes = []; let courant = [], p = 0;
        for (const t of tokens) {
            if (t.type === 'PAREN_O' || t.type === 'CROCHET_O') { p++; courant.push(t); }
            else if (t.type === 'PAREN_F' || t.type === 'CROCHET_F') { p--; courant.push(t); }
            else if (t.type === 'VIRGULE' && p === 0) { groupes.push(courant); courant = []; }
            else courant.push(t);
        }
        if (courant.length) groupes.push(courant);
        return groupes;
    }

    appliquerOp(op, g, d) {
        const vrai = v => v === true || v === 'vrai';
        switch (op) {
            case '+': return (typeof g === 'string' || typeof d === 'string') ? String(g ?? '') + String(d ?? '') : (g ?? 0) + (d ?? 0);
            case '-': return (g ?? 0) - (d ?? 0);
            case '*': return (g ?? 0) * (d ?? 0);
            case '/': if (d === 0) throw new Error('Division par zéro'); return (g ?? 0) / (d ?? 0);
            case '%': return (g ?? 0) % (d ?? 0);
            case '=': return g == d;
            case '!=': case '≠': return g != d;
            case '<': return g < d;
            case '>': return g > d;
            case '<=': case '≤': return g <= d;
            case '>=': case '≥': return g >= d;
            case 'et': return vrai(g) && vrai(d);
            case 'ou': return vrai(g) || vrai(d);
        }
        return null;
    }

    formater(v) {
        if (Array.isArray(v)) return '[' + v.map(x => this.formater(x)).join(', ') + ']';
        if (v === true) return 'vrai';
        if (v === false) return 'faux';
        if (v === null || v === undefined) return 'nul';
        if (typeof v === 'number' && !Number.isInteger(v)) return parseFloat(v.toFixed(10)).toString();
        return String(v);
    }
}

let panneau = null;

function getPanneau() {
    if (!panneau || panneau._disposed) {
        panneau = vscode.window.createOutputChannel('FrançaisScript', { log: false });
    }
    return panneau;
}

function executerCode(code, nomFichier) {
    const out = getPanneau();
    out.clear();
    out.show(true);

    const separateur = '─'.repeat(50);
    const horodatage = new Date().toLocaleTimeString('fr-FR');

    out.appendLine(`╔${separateur}╗`);
    out.appendLine(`║  FrançaisScript ${nomFichier}  ·  ${horodatage}║`);
    out.appendLine(`╚${separateur}╝`);
    out.appendLine('');

    const interp = new Interpreteur();
    const debut = Date.now();
    let erreur = null;

    try {
        interp.interpreter(code);
    } catch (e) {
        erreur = e.message;
    }

    const duree = Date.now() - debut;

    if (interp.sortie.length > 0) {
        interp.sortie.forEach(ligne => out.appendLine(ligne));
    } else if (!erreur) {
        out.appendLine('(Aucune sortie)');
    }

    if (erreur) {
        out.appendLine('');
        out.appendLine(`⚠  Erreur : ${erreur}`);
    }

    out.appendLine('');
    out.appendLine(`${separateur}`);
    out.appendLine(`  ✓ Exécuté en ${duree} ms  ·  ${interp.sortie.length} ligne(s) de sortie`);
}

function activate(context) {


    const cmdExecuter = vscode.commands.registerCommand('francaisscript.executer', async () => {
        const editeur = vscode.window.activeTextEditor;
        if (!editeur) {
            vscode.window.showWarningMessage('FrançaisScript : Ouvrez un fichier .fs pour l\'exécuter.');
            return;
        }
        if (editeur.document.languageId !== 'francaisscript') {
            vscode.window.showWarningMessage('FrançaisScript : Ce fichier n\'est pas un fichier .fs');
            return;
        }

        // Sauvegarder avant d'exécuter
        await editeur.document.save();

        const code = editeur.document.getText();
        const nomFichier = editeur.document.fileName.split(/[\\/]/).pop();

        executerCode(code, nomFichier);

        vscode.window.setStatusBarMessage('$(check) FrançaisScript : Exécution terminée', 3000);
    });

    const cmdNouveau = vscode.commands.registerCommand('francaisscript.nouveauFichier', async () => {
        const contenu = `# Mon programme FrançaisScript
# ================================

variable prenom = "Alice"
variable age = 25

afficher "Bonjour " + prenom + " !"

si age >= 18 alors
  afficher prenom + " est majeure."
sinon
  afficher prenom + " est mineure."
fin si
`;
        const doc = await vscode.workspace.openTextDocument({
            language: 'francaisscript',
            content: contenu
        });
        await vscode.window.showTextDocument(doc);
    });

    const completion = vscode.languages.registerCompletionItemProvider(
        { language: 'francaisscript' },
        {
            provideCompletionItems(document, position) {
                const items = [];

                const motsCles = [
                    ['variable', 'Déclare une variable', vscode.CompletionItemKind.Keyword],
                    ['liste', 'Déclare une liste', vscode.CompletionItemKind.Keyword],
                    ['afficher', 'Affiche une valeur', vscode.CompletionItemKind.Function],
                    ['si', 'Début d\'une condition', vscode.CompletionItemKind.Keyword],
                    ['alors', 'Suite d\'une condition', vscode.CompletionItemKind.Keyword],
                    ['sinon', 'Branche alternative', vscode.CompletionItemKind.Keyword],
                    ['fin si', 'Fin de la condition', vscode.CompletionItemKind.Keyword],
                    ['tant que', 'Début d\'une boucle', vscode.CompletionItemKind.Keyword],
                    ['faire', 'Suite de tant que', vscode.CompletionItemKind.Keyword],
                    ['fin tant que', 'Fin de la boucle', vscode.CompletionItemKind.Keyword],
                    ['répéter', 'Boucle N fois', vscode.CompletionItemKind.Keyword],
                    ['fois', 'Fin de répéter', vscode.CompletionItemKind.Keyword],
                    ['fin répéter', 'Fin de répéter', vscode.CompletionItemKind.Keyword],
                    ['fonction', 'Définit une fonction', vscode.CompletionItemKind.Keyword],
                    ['fin fonction', 'Fin de la fonction', vscode.CompletionItemKind.Keyword],
                    ['retourner', 'Retourne une valeur', vscode.CompletionItemKind.Keyword],
                    ['ajouter', 'Ajoute à une liste', vscode.CompletionItemKind.Keyword],
                    ['vrai', 'Valeur booléenne vraie', vscode.CompletionItemKind.Constant],
                    ['faux', 'Valeur booléenne fausse', vscode.CompletionItemKind.Constant],
                    ['nul', 'Valeur nulle', vscode.CompletionItemKind.Constant],
                    ['et', 'Opérateur logique ET', vscode.CompletionItemKind.Operator],
                    ['ou', 'Opérateur logique OU', vscode.CompletionItemKind.Operator],
                    ['non', 'Opérateur logique NON', vscode.CompletionItemKind.Operator],
                ];

                const fonctionsBuiltin = [
                    ['hasard(min, max)', 'hasard(${1:1}, ${2:100})', 'Nombre entier aléatoire entre min et max'],
                    ['arrondi(n)', 'arrondi(${1:n})', 'Arrondit à l\'entier le plus proche'],
                    ['plancher(n)', 'plancher(${1:n})', 'Arrondit vers le bas'],
                    ['plafond(n)', 'plafond(${1:n})', 'Arrondit vers le haut'],
                    ['absolu(n)', 'absolu(${1:n})', 'Valeur absolue'],
                    ['racine(n)', 'racine(${1:n})', 'Racine carrée'],
                    ['texte(val)', 'texte(${1:val})', 'Convertit en texte'],
                    ['nombre(val)', 'nombre(${1:val})', 'Convertit en nombre'],
                    ['longueur(val)', 'longueur(${1:val})', 'Taille d\'une liste ou d\'un texte'],
                    ['majuscules(t)', 'majuscules(${1:texte})', 'Convertit en majuscules'],
                    ['minuscules(t)', 'minuscules(${1:texte})', 'Convertit en minuscules'],
                    ['inverser(val)', 'inverser(${1:val})', 'Inverse un texte ou une liste'],
                    ['contient(val, s)', 'contient(${1:val}, ${2:s})', 'Vérifie si val contient s'],
                ];

                for (const [label, desc, kind] of motsCles) {
                    const item = new vscode.CompletionItem(label, kind);
                    item.documentation = new vscode.MarkdownString(desc);
                    items.push(item);
                }

                for (const [label, snippet, desc] of fonctionsBuiltin) {
                    const item = new vscode.CompletionItem(label, vscode.CompletionItemKind.Function);
                    item.insertText = new vscode.SnippetString(snippet);
                    item.documentation = new vscode.MarkdownString(desc);
                    item.detail = 'Fonction intégrée FrançaisScript';
                    items.push(item);
                }

                return items;
            }
        }
    );

    const hover = vscode.languages.registerHoverProvider(
        { language: 'francaisscript' },
        {
            provideHover(document, position) {
                const range = document.getWordRangeAtPosition(position, /[a-zA-ZÀ-ÿ_][a-zA-ZÀ-ÿ0-9_]*/);
                if (!range) return null;
                const mot = document.getText(range);

                const docs = {
                    'variable': '**variable** *nom* = *valeur*\n\nDéclare ou modifie une variable.',
                    'liste': '**liste** *nom* = [*valeurs*]\n\nDéclare une liste de valeurs.',
                    'afficher': '**afficher** *expression*\n\nAffiche une valeur dans la console.',
                    'si': '**si** *condition* **alors**\n\nDémarre un bloc conditionnel.',
                    'tant': '**tant que** *condition* **faire**\n\nBoucle qui s\'exécute tant que la condition est vraie.',
                    'répéter': '**répéter** *N* **fois**\n\nRépète un bloc N fois.',
                    'fonction': '**fonction** *nom*(*params*)\n\nDéfinit une fonction réutilisable.',
                    'retourner': '**retourner** *valeur*\n\nRetourne une valeur depuis une fonction.',
                    'hasard': '**hasard**(min, max)\n\nRetourne un entier aléatoire entre min et max.',
                    'arrondi': '**arrondi**(n)\n\nArrondit n à l\'entier le plus proche.',
                    'plancher': '**plancher**(n)\n\nArrondit n vers le bas (⌊n⌋).',
                    'plafond': '**plafond**(n)\n\nArrondit n vers le haut (⌈n⌉).',
                    'absolu': '**absolu**(n)\n\nRetourne la valeur absolue de n.',
                    'racine': '**racine**(n)\n\nRetourne la racine carrée de n.',
                    'texte': '**texte**(val)\n\nConvertit val en texte (chaîne de caractères).',
                    'nombre': '**nombre**(val)\n\nConvertit val en nombre.',
                    'longueur': '**longueur**(val)\n\nRetourne la taille d\'une liste ou d\'un texte.',
                    'majuscules': '**majuscules**(t)\n\nConvertit t en majuscules.',
                    'minuscules': '**minuscules**(t)\n\nConvertit t en minuscules.',
                    'inverser': '**inverser**(val)\n\nInverse un texte ou une liste.',
                    'contient': '**contient**(val, s)\n\nRetourne vrai si val contient s.',
                    'ajouter': '**ajouter** *valeur* **à** *liste*\n\nAjoute un élément à la fin d\'une liste.',
                    'vrai': '**vrai** — valeur booléenne vraie.',
                    'faux': '**faux** — valeur booléenne fausse.',
                    'nul': '**nul** — absence de valeur.',
                    'et': '**et** — opérateur logique : les deux conditions doivent être vraies.',
                    'ou': '**ou** — opérateur logique : au moins une condition doit être vraie.',
                    'non': '**non** — opérateur de négation logique.',
                };

                if (mot in docs) {
                    const md = new vscode.MarkdownString();
                    md.appendMarkdown(`🇫🇷 **FrançaisScript**\n\n${docs[mot]}`);
                    return new vscode.Hover(md, range);
                }
                return null;
            }
        }
    );

    const barreStatut = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    barreStatut.command = 'francaisscript.executer';
    barreStatut.text = '$(play) FrançaisScript';
    barreStatut.tooltip = 'Exécuter le programme (Ctrl+Entrée)';
    barreStatut.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');

    const mettreAJourStatut = (editeur) => {
        if (editeur && editeur.document.languageId === 'francaisscript') {
            barreStatut.show();
        } else {
            barreStatut.hide();
        }
    };

    vscode.window.onDidChangeActiveTextEditor(mettreAJourStatut, null, context.subscriptions);
    mettreAJourStatut(vscode.window.activeTextEditor);

    context.subscriptions.push(cmdExecuter, cmdNouveau, completion, hover, barreStatut);

    vscode.window.showInformationMessage('FrançaisScript activé ! Ouvrez un fichier .frs et appuyez sur Ctrl+Entrée pour exécuter.');
}

function deactivate() {
    if (panneau) panneau.dispose();
}

module.exports = { activate, deactivate };
