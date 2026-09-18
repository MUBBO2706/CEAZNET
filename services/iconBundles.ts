// IconBundles
// Statically importing massive JSON icon collections causes OOM errors during build.
// Icons will now be loaded dynamically from the Iconify API on-demand.

export const LOCAL_COLLECTIONS: Record<string, any> = {};

export const registerLocalIconCollections = () => {
    console.log('[IconBundles] Static offline icon registration disabled to prevent OOM. Icons load dynamically.');
};

// Auto-register on module import
registerLocalIconCollections();
