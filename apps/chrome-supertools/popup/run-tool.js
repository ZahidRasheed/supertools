export async function statusFromToolRun(run) {
  try {
    return await run();
  } catch (err) {
    return err?.message || 'Tool failed';
  }
}
