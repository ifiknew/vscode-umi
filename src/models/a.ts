export default {
  namespace: 'hello',
  state: {

  },
  reducers: {
    add(state: any, { payload: todo }: any) {
      // 保存数据到 state
      return [...state, todo];
    },
  },
  effects: {
    *save({ payload: todo }: any, { put, call }: any) {
      yield put({ type: 'add', payload: todo });
    },
  },
}