import { MoleculeData } from '../types';

interface PubChemProperty {
    CID: number;
    MolecularFormula: string;
    MolecularWeight: string;
    IUPACName: string;
}

interface PubChemResponse {
    PropertyTable: {
        Properties: PubChemProperty[];
    };
}

/**
 * Fetches the PubChem Compound ID (CID) for a given molecule name.
 */
const getMoleculeCID = async (moleculeName: string): Promise<string> => {
    const url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(moleculeName)}/cids/JSON`;
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`PubChem CID search failed for "${moleculeName}" with status: ${response.status}`);
    }
    const data = await response.json();
    const cid = data?.IdentifierList?.CID?.[0];
    if (!cid) {
        throw new Error(`Could not find a PubChem Compound ID for "${moleculeName}".`);
    }
    return cid.toString();
};

/**
 * Fetches the 3D structure data in SDF format from PubChem using a CID.
 */
const fetchMoleculeSDF = async (cid: string): Promise<string> => {
    const url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/SDF?record_type=3d`;
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch 3D SDF data for CID ${cid} with status: ${response.status}`);
    }
    const sdfData = await response.text();
    if (!sdfData || !sdfData.includes('V2000')) {
         throw new Error(`Invalid or empty SDF data received for CID ${cid}.`);
    }
    return sdfData;
};

/**
 * Fetches key properties of a molecule from PubChem using a CID.
 */
export const fetchMoleculeProperties = async (cid: string): Promise<PubChemProperty | null> => {
    const url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/property/MolecularFormula,MolecularWeight,IUPACName/JSON`;
    const response = await fetch(url);
    if (!response.ok) {
        console.error(`Failed to fetch properties for CID ${cid}, status: ${response.status}`);
        return null; // Non-critical, so we can proceed without it
    }
    const data: PubChemResponse = await response.json();
    return data?.PropertyTable?.Properties?.[0] ?? null;
};

/**
 * Parses a string in SDF format into a structured MoleculeData object.
 */
export const parseSDF = (sdfData: string): Pick<MoleculeData, 'atoms' | 'bonds'> => {
    const lines = sdfData.split('\n');
    const atomCountLine = lines[3];
    if (!atomCountLine) throw new Error("Invalid SDF format: Missing header line.");

    const atomCount = parseInt(atomCountLine.substring(0, 3).trim(), 10);
    const bondCount = parseInt(atomCountLine.substring(3, 6).trim(), 10);

    if (isNaN(atomCount) || isNaN(bondCount)) {
        throw new Error("Invalid SDF format: Could not parse atom and bond counts.");
    }
    
    const atoms = [];
    const bonds = [];
    
    const atomBlockStart = 4;
    for (let i = 0; i < atomCount; i++) {
        const line = lines[atomBlockStart + i];
        if (!line) continue;
        const x = parseFloat(line.substring(0, 10).trim());
        const y = parseFloat(line.substring(10, 20).trim());
        const z = parseFloat(line.substring(20, 30).trim());
        const element = line.substring(31, 34).trim();
        atoms.push({ element, x, y, z });
    }

    const bondBlockStart = atomBlockStart + atomCount;
    for (let i = 0; i < bondCount; i++) {
        const line = lines[bondBlockStart + i];
        if (!line) continue;
        const from = parseInt(line.substring(0, 3).trim(), 10) - 1; // SDF is 1-indexed
        const to = parseInt(line.substring(3, 6).trim(), 10) - 1;   // SDF is 1-indexed
        const order = parseInt(line.substring(6, 9).trim(), 10);
        bonds.push({ from, to, order });
    }

    return { atoms, bonds };
};

/**
 * Main service function to get all molecule data (3D structure and properties).
 */
export const getMoleculeData = async (moleculeName: string): Promise<MoleculeData> => {
    // Hardcoded fallback for Caffeine to ensure the home view always has a demo
    if (moleculeName.toLowerCase() === 'caffeine') {
        try {
            return await fetchFromPubChem(moleculeName);
        } catch (e) {
            console.warn("PubChem fetch failed for Caffeine, using fallback data.", e);
            const { atoms, bonds } = parseSDF(CAFFEINE_SDF);
            return {
                atoms,
                bonds,
                molecularFormula: 'C8H10N4O2',
                molecularWeight: '194.19',
                iupacName: '1,3,7-trimethylpurine-2,6-dione'
            };
        }
    }

    return await fetchFromPubChem(moleculeName);
};

export const getMoleculeSummary = async (moleculeName: string): Promise<Partial<MoleculeData>> => {
    try {
        const cid = await getMoleculeCID(moleculeName);
        const properties = await fetchMoleculeProperties(cid);
        return {
            molecularFormula: properties?.MolecularFormula,
            molecularWeight: properties?.MolecularWeight,
            iupacName: properties?.IUPACName
        };
    } catch {
        if (moleculeName.toLowerCase() === 'caffeine') {
            return {
                molecularFormula: 'C8H10N4O2',
                molecularWeight: '194.19',
                iupacName: '1,3,7-trimethylpurine-2,6-dione'
            };
        }
        return {};
    }
};

const fetchFromPubChem = async (moleculeName: string): Promise<MoleculeData> => {
    const cid = await getMoleculeCID(moleculeName);
    
    // Fetch SDF and properties concurrently
    const [sdfData, properties] = await Promise.all([
        fetchMoleculeSDF(cid),
        fetchMoleculeProperties(cid)
    ]);

    const { atoms, bonds } = parseSDF(sdfData);

    return {
        atoms,
        bonds,
        molecularFormula: properties?.MolecularFormula,
        molecularWeight: properties?.MolecularWeight,
        iupacName: properties?.IUPACName
    };
};

// Fallback Data
const CAFFEINE_SDF = `
  -OEChem-01012100002D

 24 25  0     0  0  0  0  0  0999 V2000
    2.3946    1.7063    0.0006 O   0  0  0  0  0  0  0  0  0  0  0  0
   -2.4805   -1.3323   -0.0006 O   0  0  0  0  0  0  0  0  0  0  0  0
   -0.1983    1.3435    0.0002 N   0  0  0  0  0  0  0  0  0  0  0  0
    1.2588   -0.4497   -0.0002 N   0  0  0  0  0  0  0  0  0  0  0  0
   -1.0968   -0.7417   -0.0003 N   0  0  0  0  0  0  0  0  0  0  0  0
   -2.0494    1.2891    0.0001 N   0  0  0  0  0  0  0  0  0  0  0  0
    1.1895    0.9328    0.0003 C   0  0  0  0  0  0  0  0  0  0  0  0
    0.0384   -0.0094   -0.0001 C   0  0  0  0  0  0  0  0  0  0  0  0
   -1.2625    0.6486   -0.0001 C   0  0  0  0  0  0  0  0  0  0  0  0
   -1.2828   -2.1887   -0.0006 C   0  0  0  0  0  0  0  0  0  0  0  0
   -3.4839    0.9856    0.0002 C   0  0  0  0  0  0  0  0  0  0  0  0
   -1.5543    2.5786    0.0004 C   0  0  0  0  0  0  0  0  0  0  0  0
    2.5698   -1.0896   -0.0004 C   0  0  0  0  0  0  0  0  0  0  0  0
   -0.6277    2.7235    0.0005 H   0  0  0  0  0  0  0  0  0  0  0  0
   -0.7264   -2.5768    0.8872 H   0  0  0  0  0  0  0  0  0  0  0  0
   -0.7259   -2.5771   -0.8880 H   0  0  0  0  0  0  0  0  0  0  0  0
   -2.3364   -2.4632   -0.0008 H   0  0  0  0  0  0  0  0  0  0  0  0
   -3.8827    1.4883   -0.8927 H   0  0  0  0  0  0  0  0  0  0  0  0
   -3.8823    1.4886    0.8931 H   0  0  0  0  0  0  0  0  0  0  0  0
   -3.6705   -0.0869    0.0003 H   0  0  0  0  0  0  0  0  0  0  0  0
    2.4578   -2.1729   -0.0006 H   0  0  0  0  0  0  0  0  0  0  0  0
    3.1257   -0.7845   -0.8929 H   0  0  0  0  0  0  0  0  0  0  0  0
    3.1259   -0.7842    0.8919 H   0  0  0  0  0  0  0  0  0  0  0  0
    0.0000    0.0000    0.0000 H   0  0  0  0  0  0  0  0  0  0  0  0
  1  7  2  0  0  0  0
  2 10  2  0  0  0  0
  3  7  1  0  0  0  0
  3  9  1  0  0  0  0
  3 12  1  0  0  0  0
  4  7  1  0  0  0  0
  4  8  1  0  0  0  0
  4 13  1  0  0  0  0
  5  8  1  0  0  0  0
  5  9  1  0  0  0  0
  5 10  1  0  0  0  0
  6  9  1  0  0  0  0
  6 11  1  0  0  0  0
  6 12  1  0  0  0  0
  8  9  2  0  0  0  0
 10 15  1  0  0  0  0
 10 16  1  0  0  0  0
 10 17  1  0  0  0  0
 11 18  1  0  0  0  0
 11 19  1  0  0  0  0
 11 20  1  0  0  0  0
 12 14  1  0  0  0  0
 13 21  1  0  0  0  0
 13 22  1  0  0  0  0
 13 23  1  0  0  0  0
M  END
`;