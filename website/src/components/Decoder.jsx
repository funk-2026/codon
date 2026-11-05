import { useState } from 'react';
import { Helix } from './Art';

// Standard genetic code, base order U C A G (NCBI table 1)
const B = 'UCAG';
const AA = 'FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG';
const NAME = { F: ['Phenylalanine', 'Phe'], L: ['Leucine', 'Leu'], S: ['Serine', 'Ser'], Y: ['Tyrosine', 'Tyr'], C: ['Cysteine', 'Cys'], W: ['Tryptophan', 'Trp'], P: ['Proline', 'Pro'], H: ['Histidine', 'His'], Q: ['Glutamine', 'Gln'], R: ['Arginine', 'Arg'], I: ['Isoleucine', 'Ile'], M: ['Methionine', 'Met'], T: ['Threonine', 'Thr'], N: ['Asparagine', 'Asn'], K: ['Lysine', 'Lys'], V: ['Valine', 'Val'], A: ['Alanine', 'Ala'], D: ['Aspartic acid', 'Asp'], E: ['Glutamic acid', 'Glu'], G: ['Glycine', 'Gly'] };

// Pick three bases, see the amino acid, and build a protein chain until a stop codon.
export default function Decoder() {
  const [pick, setPick] = useState([null, null, null]);
  const [chain, setChain] = useState([]);
  const [ended, setEnded] = useState(false);

  const full = pick.every(Boolean);
  const aa = full ? AA[B.indexOf(pick[0]) * 16 + B.indexOf(pick[1]) * 4 + B.indexOf(pick[2])] : null;
  const codon = pick.join('');
  const set = (p, b) => setPick((x) => x.map((v, i) => (i === p ? (v === b ? null : b) : v)));
  const add = () => { if (!aa || ended) return; if (aa === '*') { setChain((c) => [...c, 'Stop']); setEnded(true); } else setChain((c) => [...c, NAME[aa][1]]); };
  const reset = () => { setChain([]); setEnded(false); setPick([null, null, null]); };

  return (
    <div className="dec" data-reveal style={{ '--d': 2 }}>
      <Helix w={100} periods={2} lam={200} amp={32} />
      <div className="dec__slots">
        {[0, 1, 2].map((p) => (
          <div className="dec__slot" key={p}>
            <span>Base {p + 1}</span>
            <div className="dec__bases">
              {[...B].map((b) => <button key={b} className="base" type="button" aria-pressed={pick[p] === b} onClick={() => set(p, b)}>{b}</button>)}
            </div>
          </div>
        ))}
      </div>
      <div className="dec__out">
        <div className="dec__tri" aria-hidden="true">{pick.map((b, i) => <i key={i} className={b ? 'on' : ''}>{b || '·'}</i>)}</div>
        <div className="dec__aa" aria-live="polite">
          {!aa && <><b>Pick three bases</b><span>U, C, A, G — in each of the three positions</span></>}
          {aa === '*' && <><b>Stop codon <span className="dec__flag">Stop</span></b><span>No amino acid — translation ends here</span></>}
          {aa && aa !== '*' && <><b>{NAME[aa][0]}{codon === 'AUG' && <> <span className="dec__flag">Start</span></>}</b><span>{NAME[aa][1]} · {aa}{codon === 'AUG' ? ' · also the start codon' : ''}</span></>}
        </div>
      </div>
      <div className="dec__chain">
        {chain.length ? chain.map((c, i) => <span key={i} className={`bead${c === 'Stop' ? ' stop' : ''}`} title={c}>{c}</span>) : <p>Add codons to build a protein chain.</p>}
        {ended && <p>&nbsp;Protein complete.</p>}
      </div>
      <div className="dec__actions">
        <button className="btn btn--light" type="button" disabled={!aa || ended} onClick={add}><span className="btn__label">Add to chain</span></button>
        <button className="btn btn--ghost" type="button" onClick={() => setPick([...'AUG'])}><span className="btn__label">Try AUG</span></button>
        <button className="btn btn--ghost" type="button" onClick={() => setPick([...'UAA'])}><span className="btn__label">Try UAA</span></button>
        <button className="btn btn--ghost" type="button" onClick={reset}><span className="btn__label">Reset</span></button>
      </div>
    </div>
  );
}
