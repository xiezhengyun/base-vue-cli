import { cellStarts, cellForced, defaultRenderCell, treeCellPrefix } from './config'
import { mergeOptions, parseWidth, parseMinWidth, compose } from './util'
import ElCheckbox from 'element-ui/packages/checkbox'

let columnIdSeed = 1

export default {
  name: 'UTableColumn',
  props: {
    type: {
      type: String,
      default: 'default'
    },
    borderLine: {
      type: Boolean,
      default: true
    }, // 修改源码 表格右边线框
    // 修改源码在某一列上加上展开树形数据的标识
    treeNode: {
      type: Boolean,
      default: false
    },
    label: String,
    className: String,
    labelClassName: String,
    property: String,
    prop: String,
    width: {},
    minWidth: {},
    renderHeader: Function,
    sortable: {
      type: [Boolean, String],
      default: false
    },
    sortMethod: Function,
    sortBy: [String, Function, Array],
    resizable: {
      type: Boolean,
      default: true
    },
    columnKey: String,
    align: String,
    headerAlign: String,
    showTooltipWhenOverflow: Boolean,
    showOverflowTooltip: Boolean,
    fixed: [Boolean, String],
    formatter: Function,
    selectable: Function,
    reserveSelection: Boolean,
    filterMethod: Function,
    filteredValue: Array,
    filters: Array,
    filterPlacement: String,
    filterMultiple: {
      type: Boolean,
      default: true
    },
    index: [Number, Function],
    sortOrders: {
      type: Array,
      default () {
        return ['ascending', 'descending', null]
      },
      validator (val) {
        return val.every(order => ['ascending', 'descending', null].indexOf(order) > -1)
      }
    }
  },

  data () {
    return {
      isSubColumn: false,
      columns: []
    }
  },

  computed: {
    owner () {
      let parent = this.$parent
      while (parent && !parent.tableId) {
        parent = parent.$parent
      }
      return parent
    },

    columnOrTableParent () {
      let parent = this.$parent
      while (parent && !parent.tableId && !parent.columnId) {
        parent = parent.$parent
      }
      return parent
    },

    realWidth () {
      return parseWidth(this.width)
    },

    realMinWidth () {
      return parseMinWidth(this.minWidth)
    },

    realAlign () {
      return this.align ? 'is-' + this.align : null
    },

    realHeaderAlign () {
      return this.headerAlign ? 'is-' + this.headerAlign : this.realAlign
    }
  },

  methods: {
    getPropsData (...props) {
      return props.reduce((prev, cur) => {
        if (Array.isArray(cur)) {
          cur.forEach(key => {
            prev[key] = this[key]
          })
        }
        return prev
      }, {})
    },

    getColumnElIndex (children, child) {
      return [].indexOf.call(children, child)
    },

    setColumnWidth (column) {
      if (this.realWidth) {
        column.width = this.realWidth
      }
      if (this.realMinWidth) {
        column.minWidth = this.realMinWidth
      }
      if (!column.minWidth) {
        column.minWidth = 80
      }
      column.realWidth = column.width === undefined ? column.minWidth : column.width
      return column
    },

    setColumnForcedProps (column) {
      // 对于特定类型的 column，某些属性不允许设置
      const type = column.type
      const source = cellForced[type] || {}
      Object.keys(source).forEach(prop => {
        const value = source[prop]
        if (value !== undefined) {
          column[prop] = prop === 'className' ? `${column[prop]} ${value}` : value
        }
      })
      return column
    },

    setColumnRenders (column) {
      const specialTypes = Object.keys(cellForced)
      // renderHeader 属性不推荐使用。
      if (this.renderHeader) {
        console.warn(
          '[Element Warn][TableColumn]Comparing to render-header, scoped-slot header is easier to use. We recommend users to use scoped-slot header.'
        )
      } else if (specialTypes.indexOf(column.type) === -1) {
        column.renderHeader = (h, scope) => {
          const renderHeader = this.$scopedSlots.header
          return renderHeader ? renderHeader(scope) : column.label
        }
      }

      let originRenderCell = column.renderCell
      // TODO: 这里的实现调整
      if (column.type === 'expand') {
        // 对于展开行，renderCell 不允许配置的。在上一步中已经设置过，这里需要简单封装一下。
        column.renderCell = (h, data) => <div class="cell">{originRenderCell(h, data)}</div>
        this.owner.renderExpanded = (h, data) => {
          return this.$scopedSlots.default ? this.$scopedSlots.default(data) : this.$slots.default
        }
      } else {
        // 如果列存在cell渲染就使用originRenderCell，如果不存在就使用默认的取值
        originRenderCell = originRenderCell || defaultRenderCell
        // 对 renderCell 进行包装
        column.renderCell = (h, data) => {
          let children = null
          // 是否列上存在插槽
          if (this.$scopedSlots.default) {
            children = this.$scopedSlots.default(data)
          } else {
            children = originRenderCell(h, data)
          }
          // console.log(data.column)
          const prefix = treeCellPrefix(h, data)
          const props = {
            class: 'cell',
            style: {}
          }
          let showEllipsis = ''
          if (this.owner.showBodyOverflow) {
            showEllipsis = this.owner.showBodyOverflow
            // 如何开启了虚拟，虚拟滚动不支持动态高度
          } else if (this.owner.useVirtual) {
            showEllipsis = true
          }
          // 修改源码如下if语句，开启了超出隐藏
          if (showEllipsis === 'tooltip' || column.showOverflowTooltip) {
            props.class += ' el-tooltip'
            props.style = { width: (data.column.realWidth || data.column.width) - 1 + 'px' }
          } else if (showEllipsis) {
            props.class += ' umy-table-beyond'
            props.style = { width: (data.column.realWidth || data.column.width) - 1 + 'px' }
          }
          // 修改源码, 如果存在树点击，开启了树，那么久渲染展开图标
          const row = data.row
          const plTreeTable = this.owner
          let { iconOpen, iconClose, iconLoaded = 'el-icon-loading' } = plTreeTable.treeOpts
          let iconshow = false
          // 如果不存在图标，就给默认值
          if (!iconOpen && !iconClose) {
            iconshow = true
            iconOpen = 'el-icon-arrow-right'
            iconClose = 'el-icon-arrow-right'
          } else if (iconOpen && !iconClose) {
            iconClose = 'el-icon-arrow-right'
          } else if (!iconOpen && iconClose) {
            iconOpen = 'el-icon-arrow-right'
          }
          if (plTreeTable.rowId && column.treeNode && plTreeTable.useVirtual) {
            return (
              <div {...props}>
                <div
                  class="cell--tree-node"
                  style={[{ paddingLeft: row.pl_table_level * plTreeTable.treeOpts.indent + 'px' }]}
                >
                  {plTreeTable.treeOpts.lazy && plTreeTable.plTreeloading && row[plTreeTable.treeOpts.hasChildren]
                    ? (
                    <div class="pltree-loading">
                      <i class={[iconLoaded]}></i>
                    </div>
                      )
                    : (row[plTreeTable.treeOpts.children] && row[plTreeTable.treeOpts.children].length > 0) ||
                    (plTreeTable.treeOpts.lazy && row[plTreeTable.treeOpts.hasChildren])
                        ? (
                    <div
                      class={[{ 'tree--btn-wrapper-show': row.pl_table_expand && iconshow }, 'tree--btn-wrapper']}
                      on-click={$event => this.owner.triggerTreeExpandEvent(row, 'default', $event)}
                    >
                      {iconOpen && row.pl_table_expand ? <i class={[iconOpen]}></i> : <i class={[iconClose]}></i>}
                    </div>
                          )
                        : null}
                  <div class="pl-tree-cell">
                    {prefix}
                    {children}
                  </div>
                </div>
              </div>
            )
          } else {
            // 原始的el-table处理单元格信息
            return (
              <div {...props} title={[showEllipsis === 'title' && children ? children : '']}>
                {prefix}
                {children}
              </div>
            )
          }
        }
      }
      return column
    },

    registerNormalWatchers () {
      const props = [
        'label',
        'property',
        'filters',
        'filterMultiple',
        'sortable',
        'index',
        'formatter',
        'className',
        'labelClassName',
        'showOverflowTooltip'
      ]
      // 一些属性具有别名
      const aliases = {
        prop: 'property',
        realAlign: 'align',
        realHeaderAlign: 'headerAlign',
        realWidth: 'width'
      }
      const allAliases = props.reduce((prev, cur) => {
        prev[cur] = cur
        return prev
      }, aliases)

      Object.keys(allAliases).forEach(key => {
        const columnKey = aliases[key]

        this.$watch(key, newVal => {
          this.columnConfig[columnKey] = newVal
        })
      })
    },

    registerComplexWatchers () {
      const props = ['fixed']
      const aliases = {
        realWidth: 'width',
        realMinWidth: 'minWidth'
      }
      const allAliases = props.reduce((prev, cur) => {
        prev[cur] = cur
        return prev
      }, aliases)

      Object.keys(allAliases).forEach(key => {
        const columnKey = aliases[key]

        this.$watch(key, newVal => {
          this.columnConfig[columnKey] = newVal
          const updateColumns = columnKey === 'fixed'
          this.owner.store.scheduleLayout(updateColumns)
        })
      })
    }
  },

  components: {
    ElCheckbox
  },

  beforeCreate () {
    this.row = {}
    this.column = {}
    this.$index = 0
    this.columnId = ''
  },

  created () {
    const parent = this.columnOrTableParent
    this.isSubColumn = this.owner !== parent
    this.columnId = (parent.tableId || parent.columnId) + '_column_' + columnIdSeed++

    const type = this.type || 'default'
    const sortable = this.sortable === '' ? true : this.sortable
    const defaults = {
      ...cellStarts[type],
      id: this.columnId,
      type: type,
      property: this.prop || this.property,
      align: this.realAlign,
      headerAlign: this.realHeaderAlign,
      showOverflowTooltip: this.showOverflowTooltip || this.showTooltipWhenOverflow,
      // filter 相关属性
      filterable: this.filters || this.filterMethod,
      filteredValue: [],
      filterPlacement: '',
      isColumnGroup: false,
      filterOpened: false,
      // sort 相关属性
      sortable: sortable,
      // index 列
      index: this.index,
      borderLine: this.borderLine,
      treeNode: this.treeNode
    }

    const basicProps = [
      'columnKey',
      'label',
      'className',
      'labelClassName',
      'type',
      'renderHeader',
      'formatter',
      'fixed',
      'resizable'
    ]
    const sortProps = ['sortMethod', 'sortBy', 'sortOrders']
    const selectProps = ['selectable', 'reserveSelection']
    const filterProps = [
      'filterMethod',
      'filters',
      'filterMultiple',
      'filterOpened',
      'filteredValue',
      'filterPlacement'
    ]

    let column = this.getPropsData(basicProps, sortProps, selectProps, filterProps)
    column = mergeOptions(defaults, column)

    // 注意 compose 中函数执行的顺序是从右到左
    const chains = compose(this.setColumnRenders, this.setColumnWidth, this.setColumnForcedProps)
    column = chains(column)

    this.columnConfig = column

    // 注册 watcher
    this.registerNormalWatchers()
    this.registerComplexWatchers()
  },

  mounted () {
    const owner = this.owner
    const parent = this.columnOrTableParent
    const children = this.isSubColumn ? parent.$el.children : parent.$refs.hiddenColumns.children
    const columnIndex = this.getColumnElIndex(children, this.$el)
    owner.store.commit('insertColumn', this.columnConfig, columnIndex, this.isSubColumn ? parent.columnConfig : null)
  },

  destroyed () {
    if (!this.$parent) return
    const parent = this.$parent
    this.owner.store.commit('removeColumn', this.columnConfig, this.isSubColumn ? parent.columnConfig : null)
  },

  render (h) {
    // slots 也要渲染，需要计算合并表头
    return h('div', this.$slots.default)
  }
}
