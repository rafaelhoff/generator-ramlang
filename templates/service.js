  angular.module('<%= app.name %>')

  <%= resource.description %>
  .factory('<%= resource.displayName %>', ['<%= app.module %>', function(<%= app.module %>) {
    return {
  <%= resource.methods %>
    };
  }])