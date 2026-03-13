/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║            FrançaisScript — Runtime Web v1.1                 ║
 * ║     Utilisez FrançaisScript à la place de JavaScript         ║
 * ║     dans vos sites web statiques.                            ║
 * ╠══════════════════════════════════════════════════════════════╣
 * ║  Usage :                                                     ║
 * ║    <script src="francaisscript.js"></script>                 ║
 * ║                                                              ║
 * ║    <script type="text/francaisscript">                       ║
 * ║      variable titre = page.titre()                           ║
 * ║      afficher "Bonjour depuis " + titre                      ║
 * ║    </script>                                                 ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

(function (global) {
  'use strict';

  // ════════════════════════════════════════════════════════════
  //  TOKENISEUR
  // ════════════════════════════════════════════════════════════
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
          else if (code[i] === '\\' && code[i + 1] === 'n') { s += '\n'; i += 2; }
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
      if (['<=', '>=', '!=', '≠', '≤', '≥'].includes(deux)) {
        tokens.push({ type: 'OP', val: deux }); i += 2; continue;
      }
      if ('+-*/%<>='.includes(code[i])) {
        tokens.push({ type: 'OP', val: code[i++] }); continue;
      }
      if (code[i] === '[') { tokens.push({ type: 'CROCHET_O', val: '[' }); i++; continue; }
      if (code[i] === ']') { tokens.push({ type: 'CROCHET_F', val: ']' }); i++; continue; }
      if (code[i] === '(') { tokens.push({ type: 'PAREN_O', val: '(' }); i++; continue; }
      if (code[i] === ')') { tokens.push({ type: 'PAREN_F', val: ')' }); i++; continue; }
      if (code[i] === ',') { tokens.push({ type: 'VIRGULE', val: ',' }); i++; continue; }
      if (code[i] === '.') { tokens.push({ type: 'POINT', val: '.' }); i++; continue; }
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

  // ════════════════════════════════════════════════════════════
  //  INTERPRÉTEUR
  // ════════════════════════════════════════════════════════════
  class Interpreteur {
    constructor(options = {}) {
      this.sortie = [];
      this.env = [{}];
      this.fonctions = {};
      this.appels = 0;
      this.ecouteurs = {}; // { 'click:#btn': fn, ... }
      this._options = options;
    }

    ecrire(msg) {
      const s = String(msg);
      this.sortie.push(s);
      if (this._options.onAfficher) this._options.onAfficher(s);
    }

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
      // Appel de fonction ou méthode en standalone
      if (tokens[0]?.type === 'ID') {
        this.evaluerExpr(tokens);
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
        if (++iterations > 100000) throw new Error('Boucle infinie détectée (> 100 000 itérations)');
        if (!this.evaluerExpr(condTokens)) break;
        this.env.push({});
        const res = this.executerBloc(lignes, corpsStart, j);
        this.env.pop();
        if (res && res.retour !== undefined) return res;
      }
      return { i: j + 1 };
    }

    gererRepeter(lignes, i, fin) {
      const tokens = tokeniser(lignes[i]);
      const foisIdx = tokens.findIndex(t => t.val === 'fois');
      const n = this.evaluerExpr(tokens.slice(1, foisIdx));
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
      if (pO !== -1 && pF !== -1) {
        for (let k = pO + 1; k < pF; k++) {
          if (tokens[k]?.type === 'ID') params.push(tokens[k].val);
        }
      }
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

    // ── Fonctions intégrées + DOM ──
    appelerFonction(nom, args) {
      // ── Builtins classiques ──
      if (nom === 'afficher')   { this.ecrire(this.formater(args[0])); return null; }
      if (nom === 'texte')      return String(args[0] ?? '');
      if (nom === 'nombre')     return parseFloat(args[0]) || 0;
      if (nom === 'booléen')    return Boolean(args[0]);
      if (nom === 'longueur')   return Array.isArray(args[0]) ? args[0].length : String(args[0]).length;
      if (nom === 'hasard')     { const mn = Math.ceil(args[0]??0), mx = Math.floor(args[1]??100); return Math.floor(Math.random()*(mx-mn+1))+mn; }
      if (nom === 'arrondi')    return Math.round(args[0]??0);
      if (nom === 'plancher')   return Math.floor(args[0]??0);
      if (nom === 'plafond')    return Math.ceil(args[0]??0);
      if (nom === 'absolu')     return Math.abs(args[0]??0);
      if (nom === 'racine')     return Math.sqrt(args[0]??0);
      if (nom === 'puissance')  return Math.pow(args[0]??0, args[1]??1);
      if (nom === 'majuscules') return String(args[0]).toUpperCase();
      if (nom === 'minuscules') return String(args[0]).toLowerCase();
      if (nom === 'inverser')   return Array.isArray(args[0]) ? [...args[0]].reverse() : String(args[0]).split('').reverse().join('');
      if (nom === 'contient')   return Array.isArray(args[0]) ? args[0].includes(args[1]) : String(args[0]).includes(String(args[1]));
      if (nom === 'remplacer')  return String(args[0]).split(String(args[1])).join(String(args[2]??''));
      if (nom === 'couper')     return String(args[0]).split(String(args[1]??',')).map(s=>s.trim());
      if (nom === 'joindre')    return (Array.isArray(args[0]) ? args[0] : []).join(String(args[1]??''));
      if (nom === 'type')       { if (args[0]===null||args[0]===undefined) return 'nul'; if (Array.isArray(args[0])) return 'liste'; return typeof args[0] === 'string' ? 'texte' : typeof args[0] === 'number' ? 'nombre' : typeof args[0] === 'boolean' ? 'booléen' : 'objet'; }
      if (nom === 'min')        return Math.min(...args);
      if (nom === 'max')        return Math.max(...args);
      if (nom === 'attendre')   return null; // Synchrone — pas de vrai sleep

      // ── DOM — Sélection ──
      if (nom === 'element')    { const el = document.querySelector(String(args[0]??'')); return el ? _envelopper(el) : null; }
      if (nom === 'elements')   { return Array.from(document.querySelectorAll(String(args[0]??''))).map(_envelopper); }
      if (nom === 'créer')      { return _envelopper(document.createElement(String(args[0]??'div'))); }
      if (nom === 'corps')      return _envelopper(document.body);

      // ── Console & alertes ──
      if (nom === 'console')    { console.log(...args.map(a=>this.formater(a))); return null; }
      if (nom === 'alerte')     { alert(String(args[0]??'')); return null; }
      if (nom === 'confirmer')  return confirm(String(args[0]??''));
      if (nom === 'demander')   return prompt(String(args[0]??'')) ?? '';

      // ── Stockage ──
      if (nom === 'sauvegarder')  { try { localStorage.setItem(String(args[0]), JSON.stringify(args[1])); } catch(e){} return null; }
      if (nom === 'charger')      { try { const v=localStorage.getItem(String(args[0])); return v!==null?JSON.parse(v):null; } catch(e){ return null; } }
      if (nom === 'supprimer')    { try { localStorage.removeItem(String(args[0])); } catch(e){} return null; }

      // ── URL & Navigation ──
      if (nom === 'naviguer')   { window.location.href = String(args[0]??''); return null; }
      if (nom === 'recharger')  { window.location.reload(); return null; }
      if (nom === 'parametre')  { return new URLSearchParams(window.location.search).get(String(args[0]??'')) ?? null; }

      // ── Minuteries ──
      if (nom === 'aprés') {
        const ms = Number(args[0]??0);
        const fnNom = String(args[1]??'');
        setTimeout(() => { try { this.appelerFonction(fnNom, []); } catch(e){} }, ms);
        return null;
      }
      if (nom === 'chaque') {
        const ms = Number(args[0]??0);
        const fnNom = String(args[1]??'');
        return setInterval(() => { try { this.appelerFonction(fnNom, []); } catch(e){} }, ms);
      }
      if (nom === 'arrêter') { clearInterval(args[0]); clearTimeout(args[0]); return null; }

      // ── Date & Heure ──
      if (nom === 'maintenant') { const d=new Date(); return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`; }
      if (nom === 'date')       { const d=new Date(); return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`; }
      if (nom === 'heure')      { return new Date().getHours(); }
      if (nom === 'minute')     { return new Date().getMinutes(); }
      if (nom === 'seconde')    { return new Date().getSeconds(); }
      if (nom === 'timestamp')  { return Date.now(); }

      // ── Réseau (fetch simplifié) ──
      if (nom === 'fetch')      { return null; } // Non bloquant — voir examples

      // ── Fonctions utilisateur ──
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

    // Appel de méthode sur objet enveloppé : element("#id").texte("...")
    appelerMethode(objet, methode, args) {
      if (objet && typeof objet === 'object' && objet.__fs_element) {
        const el = objet.__fs_element;
        switch(methode) {
          // Lecture
          case 'texte':    return args.length ? (el.textContent = String(args[0]), objet) : el.textContent;
          case 'html':     return args.length ? (el.innerHTML = String(args[0]), objet) : el.innerHTML;
          case 'valeur':   return args.length ? (el.value = String(args[0]), objet) : el.value;
          case 'attribut': return args.length===2 ? (el.setAttribute(args[0],args[1]), objet) : el.getAttribute(String(args[0]));
          case 'style':    return args.length===2 ? (el.style[args[0]]=String(args[1]), objet) : el.style[args[0]];
          // Classes CSS
          case 'ajouter_classe':    el.classList.add(String(args[0])); return objet;
          case 'retirer_classe':    el.classList.remove(String(args[0])); return objet;
          case 'basculer_classe':   el.classList.toggle(String(args[0])); return objet;
          case 'a_classe':          return el.classList.contains(String(args[0]));
          // Visibilité
          case 'montrer':    el.style.display = args[0] ?? ''; return objet;
          case 'cacher':     el.style.display = 'none'; return objet;
          case 'visible':    return el.style.display !== 'none';
          // DOM manipulation
          case 'ajouter':    if(args[0]?.__fs_element) el.appendChild(args[0].__fs_element); else el.appendChild(document.createTextNode(String(args[0]))); return objet;
          case 'vider':      el.innerHTML = ''; return objet;
          case 'supprimer':  el.remove(); return null;
          case 'parent':     return el.parentElement ? _envelopper(el.parentElement) : null;
          case 'enfants':    return Array.from(el.children).map(_envelopper);
          case 'trouver':    { const f=el.querySelector(String(args[0]??'')); return f?_envelopper(f):null; }
          // Événements
          case 'au_clic':        return _ajouterEcouteur(el, 'click', args[0], this);
          case 'au_changement':  return _ajouterEcouteur(el, 'change', args[0], this);
          case 'a_la_saisie':    return _ajouterEcouteur(el, 'input', args[0], this);
          case 'au_survol':      return _ajouterEcouteur(el, 'mouseenter', args[0], this);
          case 'au_depart':      return _ajouterEcouteur(el, 'mouseleave', args[0], this);
          case 'a_la_soumission':return _ajouterEcouteur(el, 'submit', args[0], this);
          case 'sur':            return _ajouterEcouteur(el, String(args[0]), args[1], this);
          // Dimensions & position
          case 'largeur':    return el.offsetWidth;
          case 'hauteur':    return el.offsetHeight;
          case 'position':   { const r=el.getBoundingClientRect(); return {haut:r.top,gauche:r.left,bas:r.bottom,droite:r.right,__fs_element:false}; }
          // Focus
          case 'focaliser':  el.focus(); return objet;
          case 'defocaliser':el.blur(); return objet;
          // Défilement
          case 'defiler':    el.scrollIntoView({behavior:'smooth'}); return objet;
          // Cloner
          case 'cloner':     return _envelopper(el.cloneNode(true));
          default:
            throw new Error(`Méthode inconnue sur élément : "${methode}"`);
        }
      }
      // Méthodes sur objets page/document/fenetre
      if (objet && objet.__fs_namespace) {
        return this.appelerNamespace(objet.__fs_namespace, methode, args);
      }
      throw new Error(`Impossible d'appeler .${methode}() sur ${this.formater(objet)}`);
    }

    appelerNamespace(ns, methode, args) {
      if (ns === 'page') {
        switch(methode) {
          case 'titre':       return args.length ? (document.title=String(args[0]),null) : document.title;
          case 'url':         return window.location.href;
          case 'domaine':     return window.location.hostname;
          case 'chemin':      return window.location.pathname;
          case 'largeur':     return window.innerWidth;
          case 'hauteur':     return window.innerHeight;
          case 'thème':       return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'sombre' : 'clair';
          case 'défiler_vers':window.scrollTo({top:Number(args[0]??0),behavior:'smooth'}); return null;
          case 'défiler_haut':window.scrollTo({top:0,behavior:'smooth'}); return null;
          case 'plein_écran': document.documentElement.requestFullscreen?.(); return null;
          case 'titre_onglet':return args.length ? (document.title=String(args[0]),null) : document.title;
          default: throw new Error(`page.${methode}() inconnu`);
        }
      }
      if (ns === 'souris') {
        const pos = global.__fsSourisPos || {x:0,y:0};
        switch(methode) {
          case 'x': return pos.x;
          case 'y': return pos.y;
          default: throw new Error(`souris.${methode}() inconnu`);
        }
      }
      if (ns === 'clavier') {
        switch(methode) {
          case 'touche': return global.__fsDerniereTouche || '';
          default: throw new Error(`clavier.${methode}() inconnu`);
        }
      }
      if (ns === 'donnees') {
        switch(methode) {
          case 'sauvegarder': { try{localStorage.setItem(String(args[0]),JSON.stringify(args[1]));}catch(e){} return null; }
          case 'charger':     { try{const v=localStorage.getItem(String(args[0]));return v!==null?JSON.parse(v):null;}catch(e){return null;} }
          case 'supprimer':   { try{localStorage.removeItem(String(args[0]));}catch(e){} return null; }
          case 'vider':       { try{localStorage.clear();}catch(e){} return null; }
          case 'lister':      { try{return Object.keys(localStorage);}catch(e){return [];} }
          default: throw new Error(`donnees.${methode}() inconnu`);
        }
      }
      if (ns === 'css') {
        switch(methode) {
          case 'variable':    return args.length===2 ? (document.documentElement.style.setProperty('--'+args[0],String(args[1])),null) : getComputedStyle(document.documentElement).getPropertyValue('--'+args[0]).trim();
          default: throw new Error(`css.${methode}() inconnu`);
        }
      }
      throw new Error(`Espace de noms inconnu : ${ns}`);
    }

    evaluerExpr(tokens) {
      if (!tokens || !tokens.length) return null;

      // Dégrouper les parenthèses enveloppantes
      while (tokens.length >= 2 && tokens[0]?.type === 'PAREN_O' && tokens[tokens.length-1]?.type === 'PAREN_F') {
        let p = 0, wrap = true;
        for (let i = 0; i < tokens.length - 1; i++) {
          if (tokens[i]?.type === 'PAREN_O') p++;
          if (tokens[i]?.type === 'PAREN_F') p--;
          if (p === 0) { wrap = false; break; }
        }
        if (wrap) tokens = tokens.slice(1, -1); else break;
      }
      if (!tokens.length) return null;

      // Atome simple
      if (tokens.length === 1) {
        const t = tokens[0];
        if (t.type === 'NOMBRE') return t.val;
        if (t.type === 'CHAINE') return t.val;
        if (t.type === 'ID') {
          if (t.val === 'vrai') return true;
          if (t.val === 'faux') return false;
          if (t.val === 'nul') return null;
          if (t.val === 'page')    return { __fs_namespace: 'page' };
          if (t.val === 'souris')  return { __fs_namespace: 'souris' };
          if (t.val === 'clavier') return { __fs_namespace: 'clavier' };
          if (t.val === 'donnees' || t.val === 'données') return { __fs_namespace: 'donnees' };
          if (t.val === 'css')     return { __fs_namespace: 'css' };
          return this.obtenirVar(t.val);
        }
      }

      // non
      if (tokens[0]?.val === 'non') return !(this.evaluerExpr(tokens.slice(1)) === true);

      // Accès liste : nom[i]
      if (tokens.length >= 4 && tokens[0]?.type === 'ID' && tokens[1]?.type === 'CROCHET_O') {
        const fIdx = tokens.findIndex(t => t.type === 'CROCHET_F');
        const reste = tokens.slice(fIdx + 1);
        const liste = this.obtenirVar(tokens[0].val);
        let val = Array.isArray(liste) ? (liste[this.evaluerExpr(tokens.slice(2, fIdx))] ?? null) : null;
        return reste.length ? this._evaluerMethodes(val, reste) : val;
      }

      // Littéral liste : [...]
      if (tokens[0]?.type === 'CROCHET_O') {
        const fIdx = tokens.findIndex(t => t.type === 'CROCHET_F');
        const inner = tokens.slice(1, fIdx);
        return !inner.length ? [] : this.separerVirgules(inner).map(t => this.evaluerExpr(t));
      }

      // Chaîne de méthodes : expr.methode(args).methode2(args2)...
      if (this._aChaine(tokens)) {
        return this._evaluerChaine(tokens);
      }

      // Appel de fonction simple : nom(args)
      if (tokens[0]?.type === 'ID' && tokens[1]?.type === 'PAREN_O') {
        const nom = tokens[0].val;
        const fIdx = this._trouverParenF(tokens, 1);
        const inner = tokens.slice(2, fIdx);
        const args = inner.length ? this.separerVirgules(inner).map(t => this.evaluerExpr(t)) : [];
        const res = this.appelerFonction(nom, args);
        // S'il y a des méthodes enchaînées après
        const reste = tokens.slice(fIdx + 1);
        return reste.length ? this._evaluerMethodes(res, reste) : res;
      }

      // Opérateurs binaires (ordre de précédence)
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

    // Détecte si les tokens contiennent un point de méthode
    _aChaine(tokens) {
      let p = 0;
      for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i];
        if (t.type === 'PAREN_O' || t.type === 'CROCHET_O') p++;
        if (t.type === 'PAREN_F' || t.type === 'CROCHET_F') p--;
        if (p === 0 && t.type === 'POINT') return true;
      }
      return false;
    }

    // Évalue une chaîne d'appels : objet.methode(args).methode2(args2)
    _evaluerChaine(tokens) {
      // Trouver le premier point au niveau 0
      let p = 0, pointIdx = -1;
      for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i];
        if (t.type === 'PAREN_O' || t.type === 'CROCHET_O') p++;
        if (t.type === 'PAREN_F' || t.type === 'CROCHET_F') p--;
        if (p === 0 && t.type === 'POINT') { pointIdx = i; break; }
      }
      if (pointIdx === -1) return this.evaluerExpr(tokens);

      const objetTokens = tokens.slice(0, pointIdx);
      const reste = tokens.slice(pointIdx + 1);
      const objet = this.evaluerExpr(objetTokens);
      return this._evaluerMethodes(objet, reste);
    }

    _evaluerMethodes(objet, tokens) {
      if (!tokens.length) return objet;
      // tokens commence par un ID (nom de méthode) puis PAREN_O ... PAREN_F
      if (tokens[0]?.type !== 'ID') return objet;
      const methode = tokens[0].val;
      let fIdx = this._trouverParenF(tokens, 1);
      const inner = tokens.slice(2, fIdx);
      const args = inner.length ? this.separerVirgules(inner).map(t => this.evaluerExpr(t)) : [];
      let resultat;
      if (objet && (objet.__fs_element || objet.__fs_namespace)) {
        resultat = objet.__fs_namespace
          ? this.appelerNamespace(objet.__fs_namespace, methode, args)
          : this.appelerMethode(objet, methode, args);
      } else {
        // Méthodes sur types primitifs
        resultat = this._methodesPrimitives(objet, methode, args);
      }
      const suite = tokens.slice(fIdx + 1);
      if (suite.length && suite[0]?.type === 'POINT') {
        return this._evaluerMethodes(resultat, suite.slice(1));
      }
      return resultat;
    }

    _methodesPrimitives(val, methode, args) {
      const s = String(val ?? '');
      const arr = Array.isArray(val) ? val : null;
      switch(methode) {
        // Texte
        case 'majuscules':   return s.toUpperCase();
        case 'minuscules':   return s.toLowerCase();
        case 'inverser':     return arr ? [...arr].reverse() : s.split('').reverse().join('');
        case 'longueur':     return arr ? arr.length : s.length;
        case 'contient':     return arr ? arr.includes(args[0]) : s.includes(String(args[0]??''));
        case 'remplacer':    return s.split(String(args[0]??'')).join(String(args[1]??''));
        case 'couper':       return s.split(String(args[0]??',')).map(x=>x.trim());
        case 'commence_par': return s.startsWith(String(args[0]??''));
        case 'finit_par':    return s.endsWith(String(args[0]??''));
        case 'rogner':       return s.trim();
        case 'extraire':     return s.slice(Number(args[0]??0), args[1]!==undefined?Number(args[1]):undefined);
        case 'position':     return s.indexOf(String(args[0]??''));
        // Liste
        case 'ajouter':     if(arr){arr.push(args[0]);return val;}return null;
        case 'retirer':     if(arr){const i=arr.indexOf(args[0]);if(i!==-1)arr.splice(i,1);return val;}return null;
        case 'retirer_à':  if(arr){arr.splice(Number(args[0]),1);return val;}return null;
        case 'premier':    return arr?arr[0]??null:null;
        case 'dernier':    return arr?arr[arr.length-1]??null:null;
        case 'joindre':    return arr?arr.join(String(args[0]??'')):s;
        case 'trier':      return arr?[...arr].sort():null;
        case 'unique':     return arr?[...new Set(arr)]:null;
        case 'à':          return arr?arr[Number(args[0]??0)]??null:null;
        // Nombre
        case 'arrondi':    return Math.round(Number(val)+(args[0]??0));
        case 'texte':      return String(val);
        default:
          throw new Error(`Méthode inconnue : .${methode}() sur ${typeof val}`);
      }
    }

    _trouverParenF(tokens, startIdx) {
      let p = 0;
      for (let i = startIdx; i < tokens.length; i++) {
        if (tokens[i].type === 'PAREN_O') p++;
        if (tokens[i].type === 'PAREN_F') { p--; if (p <= 0) return i; }
      }
      return tokens.length - 1;
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
        case '+': return (typeof g === 'string' || typeof d === 'string') ? String(g??'') + String(d??'') : (g??0)+(d??0);
        case '-': return (g??0)-(d??0);
        case '*': return (g??0)*(d??0);
        case '/': if(d===0)throw new Error('Division par zéro'); return (g??0)/(d??0);
        case '%': return (g??0)%(d??0);
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
      if (v && v.__fs_element) return `[Élément ${v.__fs_element.tagName.toLowerCase()}]`;
      if (typeof v === 'number' && !Number.isInteger(v)) return parseFloat(v.toFixed(10)).toString();
      return String(v);
    }
  }

  // ════════════════════════════════════════════════════════════
  //  HELPERS DOM
  // ════════════════════════════════════════════════════════════
  function _envelopper(el) {
    return { __fs_element: el };
  }

  function _ajouterEcouteur(el, evenement, fnNomOuVal, interp) {
    const handler = (event) => {
      // Injecter des variables d'événement
      const old = interp.env;
      interp.env.push({ evenement: { cible: _envelopper(event.target), type: evenement } });
      try {
        if (typeof fnNomOuVal === 'string') {
          interp.appelerFonction(fnNomOuVal, [_envelopper(event.target)]);
        } else if (typeof fnNomOuVal === 'function') {
          fnNomOuVal(event);
        }
      } catch(e) {
        console.error('[FrançaisScript] Erreur dans écouteur :', e.message);
      }
      interp.env.pop();
    };
    el.addEventListener(evenement, handler);
    return _envelopper(el);
  }

  // ════════════════════════════════════════════════════════════
  //  MOTEUR D'EXÉCUTION WEB
  // ════════════════════════════════════════════════════════════

  // Tracker position souris globale
  document.addEventListener('mousemove', e => {
    global.__fsSourisPos = { x: e.clientX, y: e.clientY };
  });
  document.addEventListener('keydown', e => {
    global.__fsDerniereTouche = e.key;
  });

  function executerScript(code, src) {
    try {
      const interp = new Interpreteur({
        onAfficher: (msg) => {
          console.log(`[FS] ${msg}`);
        }
      });
      interp.interpreter(code);
    } catch(e) {
      console.error(`[FrançaisScript]${src ? ` (${src})` : ''} Erreur : ${e.message}`);
    }
  }

  function chargerScripts() {
    // <script type="text/francaisscript">
    const scripts = document.querySelectorAll('script[type="text/francaisscript"]');
    scripts.forEach(s => {
      if (s.src) {
        fetch(s.src)
          .then(r => r.text())
          .then(code => executerScript(code, s.src))
          .catch(e => console.error(`[FrançaisScript] Impossible de charger : ${s.src}`, e));
      } else {
        executerScript(s.textContent, null);
      }
    });

    // <fs-script src="..."> (balise personnalisée)
    const fsTags = document.querySelectorAll('fs-script');
    fsTags.forEach(s => {
      const src = s.getAttribute('src');
      if (src) {
        fetch(src)
          .then(r => r.text())
          .then(code => executerScript(code, src))
          .catch(e => console.error(`[FrançaisScript] Impossible de charger : ${src}`, e));
      } else {
        executerScript(s.textContent, null);
      }
    });
  }

  // ════════════════════════════════════════════════════════════
  //  API PUBLIQUE
  // ════════════════════════════════════════════════════════════
  const FrancaisScript = {
    version: '1.1.0',

    /** Exécute du code FrançaisScript directement depuis JS */
    executer(code) {
      const interp = new Interpreteur();
      interp.interpreter(code);
      return interp.sortie;
    },

    /** Crée un interpréteur avec options personnalisées */
    creerInterpreteur(options) {
      return new Interpreteur(options);
    },

    /** Exécute du code et retourne les lignes affichées */
    evaluer(code) {
      return this.executer(code);
    },

    /** Injecte des variables dans l'environnement avant exécution */
    executerAvec(code, variables) {
      const interp = new Interpreteur();
      Object.entries(variables).forEach(([k, v]) => interp.definirVar(k, v));
      interp.interpreter(code);
      return interp.sortie;
    },

    /** Charge et exécute un fichier .fs externe */
    chargerFichier(url) {
      return fetch(url)
        .then(r => r.text())
        .then(code => this.executer(code));
    },

    Interpreteur,
    tokeniser,
  };

  // Exposer globalement
  global.FrancaisScript = FrancaisScript;
  global.FS = FrancaisScript; // alias court

  // Auto-exécution au chargement du DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', chargerScripts);
  } else {
    chargerScripts();
  }

})(window);