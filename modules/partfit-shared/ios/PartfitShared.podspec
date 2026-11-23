Pod::Spec.new do |s|
  s.name           = 'PartfitShared'
  s.version        = '1.1.0'
  s.summary        = 'App Group bridge for the PartFit widget'
  s.description    = 'Writes the next filter due summary into the shared App Group and reloads widget timelines.'
  s.author         = 'PartFit Maintainers'
  s.homepage       = 'https://example.com/partfit'
  s.license        = 'MIT'
  s.platforms      = { :ios => '15.0' }
  s.source         = { :path => '.' }
  s.source_files   = '**/*.{h,m,mm,swift}'
  s.dependency 'ExpoModulesCore'
end
